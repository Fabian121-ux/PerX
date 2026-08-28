import { test, expect } from "@playwright/test";
import crypto from "node:crypto";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3100";
const TEST_DB = process.env.TEST_DATABASE_URL!;
const SESSION_COOKIE = process.env.SESSION_COOKIE_NAME ?? "perx_session";

async function createSession(
  page: import("@playwright/test").Page,
  email: string,
) {
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
        name: SESSION_COOKIE,
        value: token,
        domain: new URL(BASE).hostname,
        path: "/",
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);
  } finally {
    await pool.end();
  }
}

// Independent cases rather than one looping test, to avoid suite-wide timeouts.
for (const width of [320, 360, 375, 390, 430]) {
  test(`Create action is visible and tappable at ${width}px`, async ({
    browser,
  }) => {
    const page = await browser.newPage({ viewport: { width, height: 780 } });
    try {
      await createSession(page, "alice-test@perx.test");
      await page.goto(`${BASE}/app`);
      const nav = page.getByRole("navigation", { name: "Primary navigation" });
      await expect(nav).toBeVisible();

      const create = nav.getByRole("link", { name: "Create" });
      await expect(create).toBeVisible();

      const box = (await create.boundingBox())!;
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
      // Fully inside the viewport horizontally.
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width + 0.5);

      // All five primary destinations remain reachable.
      for (const name of ["Home", "Network", "Create", "Messages", "Profile"]) {
        await expect(
          nav.getByRole("link", { name: new RegExp(`^${name}`) }),
        ).toBeVisible();
      }

      // No horizontal overflow of the document.
      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);

      await create.click();
      await expect(page).toHaveURL(/\/app\/opportunities\/new/, {
        timeout: 30_000,
      });
    } finally {
      await page.close();
    }
  });
}
