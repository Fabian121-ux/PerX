import { test, expect, type Page } from "@playwright/test";
import crypto from "node:crypto";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3100";
const TEST_DB = process.env.TEST_DATABASE_URL!;
const SESSION_COOKIE = process.env.SESSION_COOKIE_NAME ?? "perx_session";

/** Widths from the PreX mobile brief, plus tablet. */
const WIDTHS = [320, 360, 375, 390, 412, 430, 768] as const;

const ROUTES = [
  { name: "home", path: "/app" },
  { name: "messages", path: "/app/messages" },
  { name: "notifications", path: "/app/notifications" },
  { name: "discover", path: "/app/discover" },
] as const;

async function signIn(page: Page, email: string) {
  const { Pool } = await import("pg");
  const pool = new Pool({ connectionString: TEST_DB, ssl: false });
  try {
    const user = await pool.query<{ id: string }>(
      `SELECT id FROM "User" WHERE email = $1`,
      [email],
    );
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
      await signIn(page, "alice-test@perx.test");

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

test("primary mobile navigation actions meet the touch-target minimum", async ({
  browser,
}) => {
  const page = await browser.newPage({ viewport: { width: 320, height: 780 } });
  try {
    await signIn(page, "alice-test@perx.test");
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
