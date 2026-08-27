import { test, expect } from "@playwright/test";
import crypto from "node:crypto";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3100";
const TEST_DB = process.env.TEST_DATABASE_URL!;

function testCuid() {
  return `c${crypto.randomBytes(12).toString("hex")}`;
}

/** Creates an isolated account this spec owns end to end. */
async function createResetUser() {
  const { Pool } = await import("pg");
  const pool = new Pool({ connectionString: TEST_DB, ssl: false });
  const runId = crypto.randomUUID().replaceAll("-", "");
  const id = testCuid();
  const email = `reset_${runId}@perx.test`;
  try {
    // bcrypt hash of "OriginalPass1" at cost 10.
    const originalHash = await import("bcryptjs").then((m) =>
      m.default.hash("OriginalPass1", 10),
    );
    await pool.query(
      `INSERT INTO "User" (
         id, email, "passwordHash", name, username,
         "accountClassification", "emailVerifiedAt", "verificationStatus",
         "isActive", "createdAt", "updatedAt"
       ) VALUES ($1,$2,$3,$4,$5,'PUBLIC_BETA_USER',NOW(),'VERIFIED',TRUE,NOW(),NOW())`,
      [
        id,
        email,
        originalHash,
        `Reset ${runId.slice(0, 6)}`,
        `reset_${runId.slice(0, 12)}`,
      ],
    );
    return { email, id };
  } finally {
    await pool.end();
  }
}

async function deleteResetUser(id: string) {
  const { Pool } = await import("pg");
  const pool = new Pool({ connectionString: TEST_DB, ssl: false });
  try {
    await pool.query(`DELETE FROM "User" WHERE id = $1`, [id]);
  } finally {
    await pool.end();
  }
}

/** Reads the freshly issued grant and mints the matching raw token. */
async function issueRawToken(userId: string) {
  const { Pool } = await import("pg");
  const pool = new Pool({ connectionString: TEST_DB, ssl: false });
  try {
    const token = crypto.randomBytes(32).toString("base64url");
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    await pool.query(
      `INSERT INTO "PasswordResetToken" (id,"tokenHash","userId","expiresAt","createdAt")
       VALUES ($1,$2,$3,$4,NOW())`,
      [testCuid(), tokenHash, userId, new Date(Date.now() + 30 * 60_000)],
    );
    return token;
  } finally {
    await pool.end();
  }
}

async function passwordHashOf(userId: string) {
  const { Pool } = await import("pg");
  const pool = new Pool({ connectionString: TEST_DB, ssl: false });
  try {
    const result = await pool.query<{ passwordHash: string }>(
      `SELECT "passwordHash" FROM "User" WHERE id = $1`,
      [userId],
    );
    return result.rows[0]?.passwordHash ?? null;
  } finally {
    await pool.end();
  }
}

test("forgot password returns a neutral response for unknown emails", async ({
  browser,
}) => {
  const page = await browser.newPage();
  try {
    await page.goto(`${BASE}/password-recovery`);
    await page.getByLabel("Email").fill("definitely-not-a-user@perx.test");
    await page.getByRole("button", { name: /send reset link/i }).click();

    // Must not disclose whether the account exists.
    await expect(page.getByText(/if that email exists/i)).toBeVisible();
    await expect(
      page.getByText(/no account|not found|does not exist/i),
    ).toHaveCount(0);
  } finally {
    await page.close();
  }
});

test("a valid reset link sets a new password and retires the token", async ({
  browser,
}) => {
  const user = await createResetUser();
  const page = await browser.newPage();
  try {
    const token = await issueRawToken(user.id);
    const before = await passwordHashOf(user.id);

    await page.goto(
      `${BASE}/reset-password?token=${encodeURIComponent(token)}`,
    );
    await expect(
      page.getByRole("heading", { name: /choose a new password/i }),
    ).toBeVisible();

    await page.locator('input[name="password"]').fill("BrandNewPass9");
    await page.locator('input[name="confirmPassword"]').fill("BrandNewPass9");
    await page.getByRole("button", { name: /update password/i }).click();

    await expect(page).toHaveURL(/passwordReset=1/, { timeout: 20_000 });

    const after = await passwordHashOf(user.id);
    expect(after).not.toBeNull();
    expect(after).not.toBe(before);

    // Single use: replaying the same link must now be refused.
    await page.goto(
      `${BASE}/reset-password?token=${encodeURIComponent(token)}`,
    );
    await expect(page.getByText(/invalid or has expired/i)).toBeVisible();
  } finally {
    await page.close();
    await deleteResetUser(user.id);
  }
});

test("an unknown reset token renders the expired state with a recovery path", async ({
  browser,
}) => {
  const page = await browser.newPage();
  try {
    await page.goto(`${BASE}/reset-password?token=not-a-real-token`);

    await expect(page.getByText(/invalid or has expired/i)).toBeVisible();
    await expect(
      page.getByRole("link", { name: /request a new reset link/i }),
    ).toBeVisible();
    // The form must not be offered for a token that cannot work.
    await expect(page.locator('input[name="password"]')).toHaveCount(0);
  } finally {
    await page.close();
  }
});
