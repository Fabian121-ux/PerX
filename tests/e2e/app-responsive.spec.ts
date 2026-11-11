import { test, expect, type Page } from "@playwright/test";
import crypto from "node:crypto";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3100";
const TEST_DB = process.env.TEST_DATABASE_URL!;
const SESSION_COOKIE = process.env.SESSION_COOKIE_NAME ?? "ptahx_session";

/** Widths from the PtahX mobile brief, plus tablet. */
const WIDTHS = [320, 360, 375, 390, 412, 430, 768] as const;

const ROUTES = [
  { name: "home", path: "/app" },
  { name: "messages", path: "/app/messages" },
  { name: "notifications", path: "/app/notifications" },
  { name: "discover", path: "/app/discover" },
  { name: "connections", path: "/app/connections" },
  { name: "settings", path: "/app/settings" },
  { name: "profile edit", path: "/app/profile/edit" },
] as const;

async function signIn(
  page: Page,
  email: string,
  options: { resetOnboarding?: boolean } = {},
) {
  const { Pool } = await import("pg");
  const pool = new Pool({ connectionString: TEST_DB, ssl: false });
  try {
    const user = await pool.query<{ id: string }>(
      `SELECT id FROM "User" WHERE email = $1`,
      [email],
    );
    if (options.resetOnboarding) {
      await pool.query(
        `UPDATE "User" SET "onboardingDismissedAt" = NULL WHERE id = $1`,
        [user.rows[0].id],
      );
    }
    const token = crypto.randomBytes(32).toString("base64url");
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    await pool.query(
      `INSERT INTO "Session" (id,"tokenHash","userId","expiresAt","createdAt","lastSeenAt")
       VALUES ($1,$2,$3,$4,NOW(),NOW())`,
      [
        `sess_${crypto.randomUUID()}`,
        tokenHash,
        user.rows[0].id,
        new Date(Date.now() + 3600e3),
      ],
    );
    await page.context().addCookies([
      {
        domain: new URL(BASE).hostname,
        httpOnly: true,
        name: SESSION_COOKIE,
        path: "/",
        sameSite: "Lax",
        value: token,
      },
    ]);
  } finally {
    await pool.end();
  }
}

for (const width of WIDTHS) {
  test(`authenticated surfaces do not scroll sideways at ${width}px`, async ({
    browser,
  }) => {
    const page = await browser.newPage({ viewport: { width, height: 780 } });
    try {
      await signIn(page, "alice-test@ptahx.test");

      const offenders: string[] = [];
      for (const route of ROUTES) {
        await page.goto(`${BASE}${route.path}`);
        // Not `networkidle`: Messages holds an SSE stream open for realtime, so
        // the network never goes idle and the wait would time out.
        await page.waitForLoadState("domcontentloaded");
        await page.locator("main").first().waitFor({ state: "visible" });
        await page.waitForTimeout(700);

        const overflow = await page.evaluate(() => {
          const doc = document.documentElement;
          const gap = doc.scrollWidth - doc.clientWidth;
          if (gap <= 1) return null;

          // Name the widest offending element so a failure is actionable
          // rather than just reporting that the page is too wide.
          const limit = doc.clientWidth;
          const widest = [...document.querySelectorAll<HTMLElement>("body *")]
            .map((el) => ({
              el,
              right: el.getBoundingClientRect().right,
            }))
            .filter((entry) => entry.right > limit + 1)
            .sort((a, b) => b.right - a.right)[0];

          return {
            gap,
            culprit: widest
              ? `${widest.el.tagName}.${String(widest.el.className).slice(0, 70)} right=${Math.round(widest.right)}`
              : "(none isolated)",
          };
        });

        if (overflow) {
          offenders.push(
            `${route.path}: overflow ${overflow.gap}px - ${overflow.culprit}`,
          );
        }
      }

      expect(offenders, offenders.join("\n")).toEqual([]);
    } finally {
      await page.close();
    }
  });
}


test("Connections guide is page-aware and can be tucked into the corner", async ({ browser }) => {
  const page = await browser.newPage({ viewport: { width: 360, height: 780 } });
  try {
    await signIn(page, "alice-test@ptahx.test", { resetOnboarding: true });
    await page.goto(`${BASE}/app/connections?tab=discover`);
    await page.waitForLoadState("domcontentloaded");

    await expect(
      page.getByRole("heading", { name: "A good place to start." }),
    ).toBeVisible();
    await page.getByRole("button", { name: /take the quick tour/i }).click();

    const guide = page.getByRole("region", {
      name: "preX getting started guide",
    });
    await expect(guide.getByRole("heading", { name: "Connections" })).toBeVisible();
    await expect(guide.getByText(/You’re currently on/)).toBeVisible();
    await expect(
      guide.getByRole("link", { name: "Messages", exact: true }),
    ).toHaveAttribute("href", "/app/messages");
    await expect(
      guide.getByText(/potential clients, customers, co-founders/),
    ).toBeVisible();
    
    await guide.dispatchEvent("pointerdown", {
      pointerId: 1,
      pointerType: "touch",
      isPrimary: true,
    });
    await page.waitForTimeout(850);
    await guide.dispatchEvent("pointerup", {
      pointerId: 1,
      pointerType: "touch",
      isPrimary: true,
    });
    await expect(guide).toHaveCount(0);

    const compactGuide = page.getByRole("button", {
      name: "Expand the getting started guide",
    });
    await expect(compactGuide).toBeVisible();
    const compactBounds = await compactGuide.boundingBox();
    expect(compactBounds?.width ?? 0).toBeLessThanOrEqual(48);
    await compactGuide.click();
    await expect(guide.getByRole("heading", { name: "Connections" })).toBeVisible();
  } finally {
    await page.close();
  }
});

test("primary mobile navigation actions meet the touch-target minimum", async ({
  browser,
}) => {
  const page = await browser.newPage({ viewport: { width: 320, height: 780 } });
  try {
    await signIn(page, "alice-test@ptahx.test");
    await page.goto(`${BASE}/app`);
    await page.waitForLoadState("domcontentloaded");
    await page.locator("main").first().waitFor({ state: "visible" });
    await page.waitForTimeout(700);

    const undersized = await page.evaluate(() => {
      const nav = document.querySelector("nav");
      if (!nav) return ["no nav rendered"];

      // 44px is the long-standing minimum comfortable touch target.
      return [...nav.querySelectorAll<HTMLElement>("a, button")]
        .filter((el) => el.offsetParent !== null)
        .map((el) => ({
          box: el.getBoundingClientRect(),
          label: el.getAttribute("aria-label") || el.textContent?.trim() || "?",
        }))
        .filter(({ box }) => box.height > 0 && box.height < 44)
        .map(({ box, label }) => `${label}: ${Math.round(box.height)}px tall`);
    });

    expect(undersized, undersized.join("\n")).toEqual([]);
  } finally {
    await page.close();
  }
});

test("Home Explore all has readable foreground/background in dark mode on a phone", async ({ browser }) => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  try {
    await signIn(page, "alice-test@ptahx.test");
    await page.goto(`${BASE}/app`);
    await page.waitForLoadState("domcontentloaded");
    const chip = page.getByRole("link", { name: "Explore all" });
    await chip.waitFor({ state: "visible" });
    await page.evaluate(() => document.documentElement.classList.add("dark"));
    const colours = await chip.evaluate((element) => {
      const styles = getComputedStyle(element);
      return { color: styles.color, background: styles.backgroundColor };
    });
    expect(colours.color).toBe("rgb(9, 37, 84)");
    expect(colours.background).toBe("rgb(255, 255, 255)");
    await chip.hover();
    const hover = await chip.evaluate((element) => {
      const styles = getComputedStyle(element);
      return { color: styles.color, background: styles.backgroundColor };
    });
    expect(hover.color).toBe("rgb(9, 37, 84)");
    expect(hover.background).toBe("rgb(229, 239, 255)");
    await chip.click();
    await expect(page).toHaveURL(/\/app\/discover/);
  } finally {
    await page.close();
  }
});


test("first-run welcome and guide fit a narrow touch screen", async ({ browser }) => {
  const width = 320;
  const page = await browser.newPage({ viewport: { width, height: 780 } });
  try {
    await signIn(page, "alice-test@ptahx.test", { resetOnboarding: true });
    await page.goto(`${BASE}/app`);
    await page.waitForLoadState("domcontentloaded");

    await expect(
      page.getByRole("heading", { name: "A good place to start." }),
    ).toBeVisible();

    const welcomeOverflow = await page.evaluate(() => ({
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
    }));
    expect(
      welcomeOverflow.documentWidth - welcomeOverflow.viewportWidth,
      "welcome modal must not force horizontal page scrolling",
    ).toBeLessThanOrEqual(1);

    await page.getByRole("button", { name: /take the quick tour/i }).click();
    const guide = page.getByRole("region", {
      name: "preX getting started guide",
    });
    await expect(guide).toBeVisible();

    const bounds = await guide.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.y).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width + 1);

    const next = guide.getByRole("button", { name: /next/i });
    await expect(next).toBeVisible();
    const nextBounds = await next.boundingBox();
    expect(nextBounds?.height ?? 0).toBeGreaterThanOrEqual(44);
  } finally {
    await page.close();
  }
});
