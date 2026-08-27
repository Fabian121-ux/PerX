import { test, expect, type Page } from "@playwright/test";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3100";

/** The device widths the PreX mobile brief requires, plus a desktop check. */
const WIDTHS = [320, 360, 375, 390, 412, 430, 768] as const;

const AUTH_ROUTES = [
  { name: "sign-in", path: "/sign-in" },
  { name: "password-recovery", path: "/password-recovery" },
  { name: "reset-password (expired)", path: "/reset-password?token=expired-x" },
] as const;

/**
 * Horizontal overflow is measured on the scrolling element rather than by
 * hunting individual nodes: a child may legitimately exceed the viewport while
 * clipped by an ancestor, but the document itself must never scroll sideways.
 */
async function horizontalOverflow(page: Page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    return {
      scrollWidth: doc.scrollWidth,
      clientWidth: doc.clientWidth,
      overflowPx: doc.scrollWidth - doc.clientWidth,
    };
  });
}

for (const width of WIDTHS) {
  for (const route of AUTH_ROUTES) {
    test(`${route.name} has no horizontal overflow at ${width}px`, async ({
      browser,
    }) => {
      const page = await browser.newPage({
        viewport: { width, height: 780 },
      });
      try {
        await page.goto(`${BASE}${route.path}`);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

        const { overflowPx, scrollWidth, clientWidth } =
          await horizontalOverflow(page);
        expect(
          overflowPx,
          `${route.path} scrolls sideways at ${width}px (scrollWidth ${scrollWidth} vs clientWidth ${clientWidth})`,
        ).toBeLessThanOrEqual(1);
      } finally {
        await page.close();
      }
    });
  }
}

test("every auth page offers a route back to sign in", async ({ browser }) => {
  const page = await browser.newPage({ viewport: { width: 375, height: 780 } });
  try {
    // The header's sign-in button is hidden below md, so a mobile user relies
    // entirely on an in-card link to escape these pages.
    await page.goto(`${BASE}/password-recovery`);
    await expect(
      page.getByRole("link", { name: /back to sign in/i }),
    ).toBeVisible();

    await page.goto(`${BASE}/reset-password?token=expired-x`);
    await expect(
      page.getByRole("link", { name: /request a new reset link/i }),
    ).toBeVisible();
  } finally {
    await page.close();
  }
});

test("the recovery submit button reports progress instead of going dead", async ({
  browser,
}) => {
  const page = await browser.newPage({ viewport: { width: 390, height: 780 } });
  try {
    await page.goto(`${BASE}/password-recovery`);

    // Hold the action open so the pending state is observable rather than racy.
    await page.route("**/password-recovery", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await route.continue();
    });

    const submit = page.getByRole("button", { name: /send reset link/i });
    await page.getByLabel("Email").fill("someone@perx.test");
    await submit.click();

    // A user who sees no acknowledgement clicks again, spending another attempt
    // against the per-user reset limit.
    await expect(
      page.getByRole("button", { name: /sending reset link/i }),
    ).toBeDisabled();
  } finally {
    await page.close();
  }
});

test("a completed reset is confirmed on the sign-in page", async ({
  browser,
}) => {
  const page = await browser.newPage({ viewport: { width: 390, height: 780 } });
  try {
    await page.goto(`${BASE}/sign-in?passwordReset=1`);

    const notice = page.getByRole("status");
    await expect(notice).toBeVisible();
    await expect(notice).toContainText(/password has been updated/i);
  } finally {
    await page.close();
  }
});

test("auth surfaces stay readable in dark mode", async ({ browser }) => {
  const page = await browser.newPage({
    colorScheme: "dark",
    viewport: { width: 390, height: 780 },
  });
  try {
    await page.goto(`${BASE}/password-recovery?status=requested`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    /*
      `globals.css` carries `!important` shims that retarget some literals
      (`bg-slate-50`, `bg-white`) onto themed variables, so those are already
      dark-safe. The status palettes - `green-50`, `amber-50`, `red-50` - have
      no such shim and stay near-white under `.dark`. This measures the rendered
      banner rather than the class name, so it stays honest either way.
    */
    const contrast = await page.evaluate(() => {
      const banner = document.querySelector<HTMLElement>(
        '[role="status"], [role="alert"]',
      );
      if (!banner) return null;

      /*
        Tailwind v4 emits modern `lab()` / `oklab()` colours, and
        `getComputedStyle` returns them verbatim. Scraping numbers out of that
        string yields lab components, not RGB, so luma comes out meaningless.
        Painting onto a canvas makes the browser do the conversion.
      */
      const context = document
        .createElement("canvas")
        .getContext("2d", { willReadFrequently: true })!;
      const luma = (value: string) => {
        context.clearRect(0, 0, 1, 1);
        context.fillStyle = value;
        context.fillRect(0, 0, 1, 1);
        const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
        return 0.299 * r + 0.587 * g + 0.114 * b;
      };

      // Resolve the painted backdrop, which may come from an ancestor.
      let node: HTMLElement | null = banner;
      let background = "rgba(0, 0, 0, 0)";
      while (node) {
        const colour = getComputedStyle(node).backgroundColor;
        const alpha = Number(colour.match(/[\d.]+/g)?.[3] ?? 1);
        if (alpha > 0.5) {
          background = colour;
          break;
        }
        node = node.parentElement;
      }

      return {
        background,
        backgroundLuma: luma(background),
        text: getComputedStyle(banner).color,
        textLuma: luma(getComputedStyle(banner).color),
      };
    });

    expect(contrast, "no status banner rendered to measure").not.toBeNull();
    // Dark text on a dark surface is the failure a flat light literal produces.
    expect(
      Math.abs(contrast!.textLuma - contrast!.backgroundLuma),
      `status banner has too little contrast in dark mode: text ${contrast!.text} on ${contrast!.background}`,
    ).toBeGreaterThan(40);
  } finally {
    await page.close();
  }
});
