import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { expect, test } from "@playwright/test";
import { Pool } from "pg";
import { enforceTestDatabaseIsolation } from "./utils/db-guard";

test("email code verifies once, creates a session, and cannot be replayed", async ({ page, context }, testInfo) => {
  test.setTimeout(120_000);
  enforceTestDatabaseIsolation();
  const db = new Pool({ connectionString: process.env.TEST_DATABASE_URL!, ssl: false });
  const userId = randomUUID();
  const grantId = randomUUID();
  const email = `verify-${userId}@ptahx.test`;
  const code = "012345";
  try {
    await db.query(
      `INSERT INTO "User" (id, email, username, name, "passwordHash",
        "accountClassification", "verificationStatus", "onboardingDismissedAt", "updatedAt")
       VALUES ($1, $2, $3, 'Code Fixture', $4, 'PUBLIC_BETA_USER',
         'PENDING', NOW(), NOW())`,
      [userId, email, `verify_${userId.replaceAll("-", "").slice(0, 20)}`, await bcrypt.hash("safe-password123", 10)],
    );
    await db.query(
      `INSERT INTO "Profile" (id, "userId", headline, biography, location, "isDiscoverable", "updatedAt")
       VALUES ($1, $2, 'Verification test', 'Isolated code verification', 'Lagos', true, NOW())`,
      [randomUUID(), userId],
    );
    await db.query(
      `INSERT INTO "EmailVerificationToken" (id, "tokenHash", "userId", "expiresAt")
       VALUES ($1, $2, $3, NOW() + INTERVAL '5 minutes')`,
      [grantId, await bcrypt.hash(code, 10), userId],
    );

    if (testInfo.project.name === "mobile-chrome") {
      await page.setViewportSize({ width: 320, height: 740 });
    }
    await page.goto(`/verify-email?status=sent&email=${encodeURIComponent(email)}`);
    await expect(page.getByRole("heading", { name: "Verify your email" })).toBeVisible();
    await expect(page.getByLabel("Email address").first()).toHaveValue(email);
    await page.getByLabel("Verification code").fill(code);
    await page.getByRole("button", { name: "Verify and continue" }).click();
    await expect(page).toHaveURL((url) => url.pathname === "/app", { timeout: 60_000 });
    const verified = await db.query<{
      emailVerifiedAt: Date | null;
      verificationStatus: string;
    }>('SELECT "emailVerifiedAt", "verificationStatus" FROM "User" WHERE id=$1',[userId]);
    expect(verified.rows[0].emailVerifiedAt).toBeTruthy();
    expect(verified.rows[0].verificationStatus).toBe("VERIFIED");
    const used = await db.query<{ consumedAt: Date | null }>('SELECT "consumedAt" FROM "EmailVerificationToken" WHERE id=$1',[grantId]);
    expect(used.rows[0].consumedAt).toBeTruthy();

    await context.clearCookies();
    await page.goto(`/verify-email?email=${encodeURIComponent(email)}`);
    await page.getByLabel("Verification code").fill(code);
    await page.getByRole("button", { name: "Verify and continue" }).click();
    await expect(page.getByRole("alert").filter({ hasText: /incorrect|expired|attempts/i })).toContainText(/incorrect|expired|attempts/i);
    expect(new URL(page.url()).pathname).toBe("/verify-email");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  } finally {
    enforceTestDatabaseIsolation();
    await db.query('DELETE FROM "User" WHERE id=$1',[userId]);
    await db.end();
  }
});

test("an expired code cannot activate an account", async ({ page }) => {
  test.setTimeout(90_000);
  enforceTestDatabaseIsolation();
  const db = new Pool({ connectionString: process.env.TEST_DATABASE_URL!, ssl: false });
  const userId = randomUUID();
  const email = `expired-${userId}@ptahx.test`;
  try {
    await db.query(
      `INSERT INTO "User" (id, email, username, name, "passwordHash",
       "accountClassification", "verificationStatus", "updatedAt")
       VALUES ($1, $2, $3, 'Code Fixture', $4, 'PUBLIC_BETA_USER', 'PENDING', NOW())`,
      [userId, email, `expired_${userId.replaceAll("-", "").slice(0, 20)}`, await bcrypt.hash("safe-password123", 10)],
    );
    await db.query(
      `INSERT INTO "EmailVerificationToken" (id, "tokenHash", "userId", "expiresAt")
       VALUES ($1, $2, $3, NOW() - INTERVAL '1 second')`,
      [randomUUID(), await bcrypt.hash("654321", 10), userId],
    );
    await page.goto(`/verify-email?email=${encodeURIComponent(email)}`);
    await page.getByLabel("Verification code").fill("654321");
    await page.getByRole("button", { name: "Verify and continue" }).click();
    await expect(page.getByRole("alert").filter({ hasText: /incorrect|expired|attempts/i })).toContainText(/incorrect|expired|attempts/i);
    const user = await db.query<{ emailVerifiedAt: Date | null }>('SELECT "emailVerifiedAt" FROM "User" WHERE id=$1',[userId]);
    expect(user.rows[0].emailVerifiedAt).toBeNull();
  } finally {
    enforceTestDatabaseIsolation();
    await db.query('DELETE FROM "User" WHERE id=$1',[userId]);
    await db.end();
  }
});
