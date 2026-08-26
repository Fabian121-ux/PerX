import { test, expect, type Page } from "@playwright/test";
import crypto from "node:crypto";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3100";
const TEST_DB = process.env.TEST_DATABASE_URL!;
const SESSION_COOKIE = process.env.SESSION_COOKIE_NAME ?? "perx_session";

async function createSession(page: Page, email: string) {
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
    return { tokenHash };
  } finally {
    await pool.end();
  }
}

async function sessionExists(tokenHash: string) {
  const { Pool } = await import("pg");
  const pool = new Pool({ connectionString: TEST_DB, ssl: false });
  try {
    const result = await pool.query(
      `SELECT 1 FROM "Session" WHERE "tokenHash" = $1`,
      [tokenHash],
    );
    return result.rowCount === 1;
  } finally {
    await pool.end();
  }
}

test("desktop sign out ends the server session and protects app routes", async ({
  browser,
}) => {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 800 },
  });
  try {
    const { tokenHash } = await createSession(page, "alice-test@perx.test");
    await page.goto(`${BASE}/app`);
    expect(await sessionExists(tokenHash)).toBe(true);

    await page.getByRole("button", { name: "Open account menu" }).click();
    await page.getByRole("button", { name: /sign out/i }).click();

    // Server authority: the row is gone, not merely a client-side redirect.
    await expect
      .poll(() => sessionExists(tokenHash), { timeout: 15_000 })
      .toBe(false);
    await expect(page).toHaveURL(/\/sign-in/, { timeout: 15_000 });

    // The stale cookie must not resurrect access to a protected route.
    await page.goto(`${BASE}/app`);
    await expect(page).toHaveURL(/\/sign-in/);
  } finally {
    await page.close();
  }
});

test("signed-out browser cannot reach a protected route with the old cookie", async ({
  browser,
}) => {
  const page = await browser.newPage();
  try {
    const { tokenHash } = await createSession(page, "alice-test@perx.test");
    await page.goto(`${BASE}/app`);

    // Invalidate server-side exactly as sign-out does.
    await page.goto(`${BASE}/api/auth/clear-session?next=/app`);
    await expect
      .poll(() => sessionExists(tokenHash), { timeout: 15_000 })
      .toBe(false);

    await page.goto(`${BASE}/app/messages`);
    await expect(page).toHaveURL(/\/sign-in/);
  } finally {
    await page.close();
  }
});

test("mobile sign out ends the session and clears cached authenticated state", async ({
  browser,
}) => {
  const page = await browser.newPage({ viewport: { width: 390, height: 800 } });
  try {
    const { tokenHash } = await createSession(page, "alice-test@perx.test");
    await page.goto(`${BASE}/app`);

    // Stand in for the authenticated caches the app writes for this account.
    await page.evaluate(() => {
      window.sessionStorage.setItem(
        "perx:home-feed:v1",
        '{"items":["private"]}',
      );
      window.sessionStorage.setItem("perx:messages:user-1:drafts", "private");
      window.localStorage.setItem("theme", "dark");
    });

    await page.getByRole("button", { name: "Open secondary menu" }).click();
    await page.getByRole("button", { name: /sign out/i }).click();

    await expect
      .poll(() => sessionExists(tokenHash), { timeout: 15_000 })
      .toBe(false);
    await expect(page).toHaveURL(/\/sign-in/, { timeout: 15_000 });

    const remaining = await page.evaluate(() => ({
      drafts: window.sessionStorage.getItem("perx:messages:user-1:drafts"),
      feed: window.sessionStorage.getItem("perx:home-feed:v1"),
      theme: window.localStorage.getItem("theme"),
    }));
    // Private per-account state is gone; device preference survives.
    expect(remaining.feed).toBeNull();
    expect(remaining.drafts).toBeNull();
    expect(remaining.theme).toBe("dark");
  } finally {
    await page.close();
  }
});
