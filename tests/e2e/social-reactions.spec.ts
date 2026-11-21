import { randomBytes, randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { expect, test } from "@playwright/test";
import { Pool } from "pg";
import { enforceTestDatabaseIsolation } from "./utils/db-guard";

test("post reactions persist, switch, and toggle from the authenticated feed", async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  enforceTestDatabaseIsolation();

  const db = new Pool({
    connectionString: process.env.TEST_DATABASE_URL!,
    ssl: false,
  });
  const userId = randomUUID();
  const postId = randomUUID();
  const password = randomBytes(24).toString("base64url");
  const email = `reaction-${userId}@ptahx.test`;
  const body = `Real reaction pipeline ${postId}`;

  async function savedReactions() {
    const result = await db.query<{ userId: string; kind: string }>(
      'SELECT "userId", kind FROM "PostReaction" WHERE "postId" = $1',
      [postId],
    );
    return result.rows;
  }

  try {
    const hash = await bcrypt.hash(password, 10);
    await db.query(
      `INSERT INTO "User"
        (id, email, username, name, "passwordHash", "accountClassification",
         "emailVerifiedAt", "verificationStatus", "onboardingDismissedAt", "updatedAt")
       VALUES ($1, $2, $3, 'Reaction Fixture', $4, 'PUBLIC_BETA_USER',
               NOW(), 'VERIFIED', NOW(), NOW())`,
      [userId, email, `reaction_${userId.replaceAll("-", "").slice(0, 20)}`, hash],
    );
    await db.query(
      `INSERT INTO "Profile"
        (id, "userId", headline, biography, location, "isDiscoverable", "updatedAt")
       VALUES ($1, $2, 'Reaction smoke test', 'Isolated browser test account',
               'Lagos', true, NOW())`,
      [randomUUID(), userId],
    );
    await db.query(
      `INSERT INTO "Post"
        (id, "authorId", body, status, "moderationStatus", "publishedAt", "updatedAt")
       VALUES ($1, $2, $3, 'PUBLISHED', 'APPROVED', NOW(), NOW())`,
      [postId, userId, body],
    );

    if (testInfo.project.name === "mobile-chrome") {
      await page.setViewportSize({ width: 320, height: 740 });
    }
    await page.goto("/sign-in?next=%2Fapp");
    await page.getByLabel("Email address").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL((url) => url.pathname === "/app", { timeout: 60_000 });

    const card = page.locator(`[data-social-post-id="${postId}"]`);
    await expect(card).toBeVisible({ timeout: 60_000 });
    await expect(card.getByText(body, { exact: true })).toBeVisible();
    await expect(card.getByTestId("reaction-count")).toHaveText("0 reactions");

    await card.getByRole("button", { name: "Like", exact: true }).click();
    await expect(card.getByRole("button", { name: "Like", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(card.getByTestId("reaction-count")).toHaveText("1 reactions");
    await expect.poll(savedReactions).toEqual([{ userId, kind: "LIKE" }]);

    await card.getByRole("button", { name: "Insightful", exact: true }).click();
    await expect(card.getByRole("button", { name: "Insightful", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(card.getByRole("button", { name: "Like", exact: true })).toHaveAttribute("aria-pressed", "false");
    await expect(card.getByTestId("reaction-count")).toHaveText("1 reactions");
    await expect.poll(savedReactions).toEqual([{ userId, kind: "INSIGHTFUL" }]);

    await card.getByRole("button", { name: "Insightful", exact: true }).click();
    await expect(card.getByRole("button", { name: "Insightful", exact: true })).toHaveAttribute("aria-pressed", "false");
    await expect(card.getByTestId("reaction-count")).toHaveText("0 reactions");
    await expect.poll(savedReactions).toEqual([]);

    await card.getByRole("button", { name: "Support", exact: true }).click();
    await expect(card.getByRole("button", { name: "Support", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect.poll(savedReactions).toEqual([{ userId, kind: "SUPPORT" }]);

    await page.reload();
    await expect(card.getByRole("button", { name: "Support", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(card.getByTestId("reaction-count")).toHaveText("1 reactions");

    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  } finally {
    enforceTestDatabaseIsolation();
    try {
      await db.query('DELETE FROM "User" WHERE id = $1', [userId]);
    } finally {
      await db.end();
    }
  }
});
