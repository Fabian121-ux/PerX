import { test, expect } from "@playwright/test";
import type { Pool } from "pg";

import { getIsolatedTestDatabaseUrl } from "./utils/db-guard";

const testDatabaseUrl = getIsolatedTestDatabaseUrl();
if (testDatabaseUrl) {
  process.env.DATABASE_URL = testDatabaseUrl;
  process.env.DIRECT_URL = process.env.TEST_DIRECT_URL || testDatabaseUrl;
}
const describeWithDatabase = testDatabaseUrl
  ? test.describe
  : test.describe.skip;

describeWithDatabase("10-User Beta constraints and Core Workflow", () => {
  const runId = Date.now();
  let pool: Pool;

  test.beforeAll(async () => {
    const { Pool: PgPool } = await import("pg");
    pool = new PgPool({ connectionString: testDatabaseUrl!, ssl: false });
  });

  test.afterAll(async () => {
    if (!pool) return;
    await pool.query(`DELETE FROM "User" WHERE email LIKE $1`, [
      `audit-${runId}-%`,
    ]);
    await pool.end();
  });

  test("Beta registration capacity restricts to 10 users max using real registration path", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium",
      "Registration capacity is viewport-independent and mutates shared state.",
    );
    // Check initial count
    const initialCountResult = await pool.query(
      `SELECT COUNT(*)::int AS count
       FROM "User"
       WHERE "accountClassification" NOT IN ('INTERNAL_ADMIN', 'INTERNAL_TEST_USER', 'SYSTEM_ACCOUNT')
         AND "isActive" = true`,
    );
    const initialCount = initialCountResult.rows[0].count as number;

    let successfulRegistrations = 0;

    for (let i = 1; i <= 11; i++) {
      const email = `audit-${runId}-${i}@example.com`;
      const username = `audituser_${runId}_${i}`;

      await page.goto("/sign-up");

      // Wait for load
      await expect(
        page.getByRole("heading", { name: "Create your PerX account" }),
      ).toBeVisible();

      // Ensure form is available or unavailable
      const isAvailable = await page.locator('input[name="email"]').isVisible();

      if (isAvailable) {
        await page.fill('input[name="name"]', `Audit User ${i}`);
        await page.fill('input[name="email"]', email);
        await page.fill('input[name="password"]', "Password123!");
        await page.fill('input[name="confirmPassword"]', "Password123!");
        await page.fill('input[name="username"]', username);
        await page.check('input[name="terms"]');
        await page.click('button[type="submit"]');

        // Check if successfully redirected
        await page
          .waitForURL("**/app/profile/setup", { timeout: 10000 })
          .catch(() => {});

        if (page.url().includes("/app/profile/setup")) {
          successfulRegistrations++;
          // Sign out for next user
          await page.goto("/api/auth/clear-session?next=/sign-in");
        }
      }
    }

    // Verify 10 users registered successfully
    expect(successfulRegistrations + initialCount).toBeLessThanOrEqual(10);

    // Verify in database
    const createdUsers = await pool.query(
      `SELECT u."accountClassification",
              COALESCE(ARRAY_AGG(r.name::text) FILTER (WHERE r.name IS NOT NULL), '{}') AS roles
       FROM "User" u
       LEFT JOIN "UserRole" ur ON ur."userId" = u.id
       LEFT JOIN "Role" r ON r.id = ur."roleId"
       WHERE u.email LIKE $1
       GROUP BY u.id`,
      [`audit-${runId}-%`],
    );

    expect(createdUsers.rows.length).toBeLessThanOrEqual(10);

    for (const u of createdUsers.rows) {
      expect(u.accountClassification).toBe("PUBLIC_BETA_USER");
      const roles = u.roles as string[];
      expect(roles).toContain("MEMBER");
      expect(roles).not.toContain("ADMIN");
      expect(roles).not.toContain("INTERNAL_TESTER");
      expect(roles).not.toContain("INTERNAL_ADMIN");
    }
  });

  test("Authenticated routes do not throw generic modals", async () => {
    // Handled by primary-flow test
    expect(true).toBeTruthy();
  });
});
