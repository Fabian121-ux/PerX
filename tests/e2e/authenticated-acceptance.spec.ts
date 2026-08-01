import { test, expect, type Page } from "@playwright/test";
import crypto from "node:crypto";

const BASE =
  process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3100";
const TEST_DB =
  process.env.TEST_DATABASE_URL ?? "";

const SESSION_COOKIE =
  process.env.SESSION_COOKIE_NAME ?? "perx_session";

const isIsolatedDb =
  TEST_DB.includes("127.0.0.1") || TEST_DB.includes("localhost");

const describeOrSkip = isIsolatedDb ? test.describe : test.describe.skip;

describeOrSkip(
  "Authenticated multi-user acceptance (requires isolated test DB)",
  () => {
  async function createSession(page: Page, email: string) {
    const { Pool } = await import("pg");
    const pool = new Pool({ connectionString: TEST_DB, ssl: false });
    try {
      const user = await pool.query(
        `SELECT id FROM "User" WHERE email = $1`,
        [email],
      );
      if (user.rows.length === 0) throw new Error(`User ${email} not found`);

      const token = crypto.randomBytes(32).toString("base64url");
      const tokenHash = crypto
        .createHash("sha256")
        .update(token)
        .digest("hex");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

      await pool.query(
        `INSERT INTO "Session" (id, "tokenHash", "userId", "expiresAt", "createdAt", "lastSeenAt")
         VALUES ($1, $2, $3, $4, NOW(), NOW())`,
        [`sess_${crypto.randomUUID()}`, tokenHash, user.rows[0].id, expiresAt],
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

      return user.rows[0].id;
    } finally {
      await pool.end();
    }
  }

  test("Alice authenticates and sees Home feed", async ({ browser }) => {
    const page = await browser.newPage();
    await createSession(page, "alice-test@perx.test");
    await page.goto(`${BASE}/app`);
    await expect(page).not.toHaveURL(/.*sign-in/);
    const bodyText = await page.innerText("body");
    expect(bodyText).not.toContain("PrismaClientInitializationError");
    expect(bodyText).not.toContain("DATABASE_URL");
    await page.close();
  });

  test("mobile bottom navigation has 5 destinations at 320px", async ({ browser }) => {
    const page = await browser.newPage({ viewport: { width: 320, height: 568 } });
    await createSession(page, "alice-test@perx.test");
    await page.goto(`${BASE}/app`);
    await page.waitForLoadState("networkidle");

    const bottomNav = page.getByRole("navigation", { name: "Primary navigation" });
    await expect(bottomNav).toBeVisible();

    const links = bottomNav.getByRole("link");
    const count = await links.count();
    expect(count).toBe(5);

    const labels = await links.allInnerTexts();
    expect(labels).toContain("Home");
    expect(labels).toContain("Connections");
    expect(labels).toContain("Create Post");
    expect(labels).toContain("Messages");
    expect(labels).toContain("Profile");
    await page.close();
  });

  test("profile page has no horizontal overflow at 320px", async ({ browser }) => {
    const page = await browser.newPage({ viewport: { width: 320, height: 568 } });
    await createSession(page, "alice-test@perx.test");
    await page.goto(`${BASE}/app/profile`);
    await page.waitForLoadState("networkidle");

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
    await page.close();
  });

  test("search page loads and shows results", async ({ browser }) => {
    const page = await browser.newPage();
    await createSession(page, "alice-test@perx.test");
    await page.goto(`${BASE}/app/search`);
    await page.waitForLoadState("networkidle");

    const bodyText = await page.innerText("body");
    expect(bodyText).toContain("Search");
    expect(bodyText).not.toContain("PrismaClientInitializationError");
    await page.close();
  });

  test("connections page loads with tabs", async ({ browser }) => {
    const page = await browser.newPage();
    await createSession(page, "alice-test@perx.test");
    await page.goto(`${BASE}/app/connections`);
    await page.waitForLoadState("networkidle");

    const bodyText = await page.innerText("body");
    expect(bodyText).toContain("Discover People");
    expect(bodyText).toContain("Connection Requests");
    expect(bodyText).toContain("My Connections");
    await page.close();
  });

  test("messages page loads for authenticated user", async ({ browser }) => {
    const page = await browser.newPage();
    await createSession(page, "alice-test@perx.test");
    await page.goto(`${BASE}/app/messages`);
    await page.waitForLoadState("networkidle");

    const bodyText = await page.innerText("body");
    expect(bodyText).toContain("Messages");
    expect(bodyText).not.toContain("PrismaClientInitializationError");
    await page.close();
  });

  test("news page loads for authenticated user", async ({ browser }) => {
    const page = await browser.newPage();
    await createSession(page, "alice-test@perx.test");
    await page.goto(`${BASE}/app/news`);
    await page.waitForLoadState("networkidle");

    const bodyText = await page.innerText("body");
    expect(bodyText).toContain("News");
    expect(bodyText).not.toContain("PrismaClientInitializationError");
    await page.close();
  });

  test("services page shows published service from another user", async ({ browser }) => {
    const page = await browser.newPage();
    await createSession(page, "bob-test@perx.test");
    await page.goto(`${BASE}/app/services`);
    await page.waitForLoadState("networkidle");

    const bodyText = await page.innerText("body");
    expect(bodyText).not.toContain("PrismaClientInitializationError");
    await page.close();
  });

  test("carol cannot access admin moderation route", async ({ browser }) => {
    const page = await browser.newPage();
    await createSession(page, "carol-test@perx.test");
    const response = await page.goto(`${BASE}/admin`);
    expect(response?.status()).toBe(404);
    await page.close();
  });

  test("MASTER_ADMIN can load admin messages page without 500", async ({ browser }) => {
    const page = await browser.newPage();
    await createSession(page, "admin-test@perx.test");
    const response = await page.goto(`${BASE}/admin/messages`);
    expect(response?.status()).toBe(200);

    const bodyText = await page.innerText("body");
    expect(bodyText).not.toContain("500");
    expect(bodyText).not.toContain("Internal Server Error");
    expect(bodyText).not.toContain("PrismaClientInitializationError");
    expect(bodyText).not.toContain("Cannot read properties");
    await page.close();
  });

  test("MASTER_ADMIN can load admin reports page without 500", async ({ browser }) => {
    const page = await browser.newPage();
    await createSession(page, "admin-test@perx.test");
    const response = await page.goto(`${BASE}/admin/reports`);
    expect(response?.status()).toBe(200);

    const bodyText = await page.innerText("body");
    expect(bodyText).not.toContain("Internal Server Error");
    expect(bodyText).not.toContain("PrismaClientInitializationError");
    await page.close();
  });

  test("MASTER_ADMIN can load moderation case detail without 500", async ({ browser }) => {
    const { Pool } = await import("pg");
    const pool = new Pool({ connectionString: TEST_DB, ssl: false });
    let caseId: string;
    try {
      const res = await pool.query(
        `SELECT id FROM "ModerationCase" WHERE source = 'MESSAGE_REPORT' LIMIT 1`,
      );
      if (res.rows.length === 0) throw new Error("No moderation case found");
      caseId = res.rows[0].id;
    } finally {
      await pool.end();
    }

    const page = await browser.newPage();
    await createSession(page, "admin-test@perx.test");
    const response = await page.goto(`${BASE}/admin/moderation/cases/${caseId}`);
    expect(response?.status()).toBe(200);

    const bodyText = await page.innerText("body");
    expect(bodyText).not.toContain("Internal Server Error");
    expect(bodyText).not.toContain("PrismaClientInitializationError");
    expect(bodyText).not.toContain("Cannot read properties");
    await page.close();
  });
});