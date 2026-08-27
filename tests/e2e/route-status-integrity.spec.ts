import { test, expect, type Page } from "@playwright/test";
import crypto from "node:crypto";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3100";
const TEST_DB = process.env.TEST_DATABASE_URL!;
const SESSION_COOKIE = process.env.SESSION_COOKIE_NAME ?? "perx_session";

/**
 * Loading UI must not cost correct HTTP status codes.
 *
 * A `loading.tsx` creates a Suspense boundary above the route, and Next flushes
 * the response as soon as that fallback streams. Any `notFound()` raised
 * afterwards by an existence or authorization gate can no longer set the
 * status, so a missing or forbidden resource answers 200 with a skeleton.
 *
 * Verified by experiment on `/app/messages/[conversationId]`: adding a
 * `loading.tsx` changed an unknown conversation from 404 to 200. These tests
 * exist so improving the loading experience cannot silently reintroduce that.
 */
async function signIn(page: Page, email: string) {
  const { Pool } = await import("pg");
  const pool = new Pool({ connectionString: TEST_DB, ssl: false });
  try {
    const user = await pool.query<{ id: string }>(
      `SELECT id FROM "User" WHERE email = $1`,
      [email],
    );
    const token = crypto.randomBytes(32).toString("base64url");
    await pool.query(
      `INSERT INTO "Session" (id,"tokenHash","userId","expiresAt","createdAt","lastSeenAt")
       VALUES ($1,$2,$3,$4,NOW(),NOW())`,
      [
        `sess_${crypto.randomUUID()}`,
        crypto.createHash("sha256").update(token).digest("hex"),
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

test("an unknown conversation answers 404, not a streamed skeleton", async ({
  browser,
}) => {
  const page = await browser.newPage();
  try {
    await signIn(page, "alice-test@perx.test");
    const response = await page.goto(
      `${BASE}/app/messages/conversation-that-does-not-exist`,
    );

    expect(response?.status()).toBe(404);
  } finally {
    await page.close();
  }
});

test("an unknown admin user answers 404 for an authorized admin", async ({
  browser,
}) => {
  const page = await browser.newPage();
  try {
    await signIn(page, "admin-test@perx.test");
    const response = await page.goto(`${BASE}/admin/users/no-such-user-id`);

    expect(response?.status()).toBe(404);
  } finally {
    await page.close();
  }
});

test("admin user detail stays hidden from a non-admin", async ({ browser }) => {
  const page = await browser.newPage();
  try {
    // carol is a MEMBER: no users:read, so the record must not exist for her.
    await signIn(page, "carol-test@perx.test");
    const response = await page.goto(`${BASE}/admin/users/any-id`);

    expect(response?.status()).toBe(404);
  } finally {
    await page.close();
  }
});
