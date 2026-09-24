import { randomBytes, randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { Pool } from "pg";
import bcrypt from "bcryptjs";
import { enforceTestDatabaseIsolation } from "./utils/db-guard";

test("public feed, account navigation and authenticated entry on desktop and narrow mobile", async ({
  page,
}, testInfo) => {
  test.setTimeout(180_000);
  enforceTestDatabaseIsolation();
  const database = new Pool({
    connectionString: process.env.TEST_DATABASE_URL!,
    ssl: false,
  });
  const namespace = randomUUID();
  const password = randomBytes(24).toString("base64url");
  const passwordHash = await bcrypt.hash(password, 10);
  const owner = {
    id: namespace,
    username: `landing_${namespace.replaceAll("-", "").slice(0, 20)}`,
    name: "Landing fixture member",
  };
  async function opportunity(
    ownerId: string,
    data: {
      title: string;
      summary?: string;
      status?: string;
      moderationStatus?: string;
      publishedAt: Date;
    },
  ) {
    const id = randomUUID();
    const slug = `landing-${id}`;
    await database.query(
      `INSERT INTO "Opportunity" (id, "ownerId", type, status, "moderationStatus", title, slug, summary, description, "publishedAt", "updatedAt") VALUES ($1,$2,'SERVICE',$3::"OpportunityStatus",$4::"ModerationStatus",$5,$6,$7,'Public landing acceptance fixture',$8,NOW())`,
      [
        id,
        ownerId,
        data.status ?? "PUBLISHED",
        data.moderationStatus ?? "APPROVED",
        data.title,
        slug,
        data.summary ?? "Public opportunity",
        data.publishedAt,
      ],
    );
    return { id, slug };
  }
  try {
    await database.query(
      `INSERT INTO "User" (id, email, username, name, "passwordHash", "accountClassification", "updatedAt") VALUES ($1,$2,$3,$4,$5,'PUBLIC_BETA_USER',NOW())`,
      [
        owner.id,
        `landing-${namespace}@ptahx.test`,
        owner.username,
        owner.name,
        passwordHash,
      ],
    );
    await database.query(
      `INSERT INTO "Profile" (id, "userId", headline, biography, location, "isDiscoverable", "updatedAt") VALUES ($1,$2,'Landing fixture','Isolated browser acceptance','Lagos',true,NOW())`,
      [randomUUID(), owner.id],
    );
    const title = `Landing acceptance ${namespace}`;
    const post = await opportunity(owner.id, {
      title,
      summary: "https://example.test/" + "long-content".repeat(30),
      publishedAt: new Date("2050-01-01"),
    });
    const second = await opportunity(owner.id, {
      title: `Second ${title}`,
      publishedAt: new Date("2049-01-01"),
    });
    const hidden = [];
    for (const status of ["DRAFT", "PAUSED"] as const)
      hidden.push(
        await opportunity(owner.id, {
          status,
          title: `${status} ${title}`,
          publishedAt: new Date("2051-01-01"),
        }),
      );
    hidden.push(
      await opportunity(owner.id, {
        moderationStatus: "REJECTED",
        title: `Rejected ${title}`,
        publishedAt: new Date("2051-01-01"),
      }),
    );
    if (testInfo.project.name === "mobile-chrome")
      await page.setViewportSize({ width: 320, height: 740 });
    await page.goto("/");
    const feed = page.getByRole("main", { name: "Public feed" });
    await expect(
      feed.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
    await expect(feed.locator("article").first()).toHaveAttribute(
      "data-post-id",
      post.id,
    );
    for (const row of hidden)
      await expect(feed.locator(`[data-post-id="${row.id}"]`)).toHaveCount(0);
    await expect(page.getByText("Main activity paths")).toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(
      await feed.evaluate((el) => el.getBoundingClientRect().width),
    ).toBeLessThanOrEqual(640);
    await feed
      .locator(`[data-post-id="${second.id}"]`)
      .scrollIntoViewIfNeeded();
    await expect(feed.locator(`[data-post-id="${second.id}"]`)).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath("public-feed.png"),
      fullPage: false,
    });
    await feed
      .locator(`[data-post-id="${post.id}"]`)
      .getByRole("link", { name: "View post", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
    await page.goto(`/u/${owner.username}`);
    await expect(
      page.getByRole("heading", { name: owner.name, exact: true }),
    ).toBeVisible();
    await page.goto("/");
    await page
      .locator(`[data-post-id="${post.id}"]`)
      .getByRole("link", { name: "Sign in to save" })
      .click();
    await expect(page).toHaveURL(new RegExp("/sign-in\\?next="));
    expect(new URL(page.url()).searchParams.get("next")).toBe(
      `/opportunities/${post.slug}`,
    );
    await page.getByRole("link", { name: "Recover password" }).click();
    await expect(page).toHaveURL(/\/password-recovery$/);
    await page.goto("/");
    await page
      .getByRole("navigation", { name: "Account" })
      .getByRole("link", { name: "Sign up", exact: true })
      .click();
    await expect(page).toHaveURL(/\/sign-up$/);
    await page.goto("/");
    await page
      .getByRole("navigation", { name: "Account" })
      .getByRole("link", { name: "Sign in", exact: true })
      .click();
    await expect(
      page.getByRole("link", { name: "Recover password" }),
    ).toBeVisible();
    expect((await page.request.get("/api/home-feed")).status()).toBe(401);

    // Use the real sign-in form and server-issued cookie; do not guess deployment cookie names.
    await page.goto(
      `/sign-in?next=${encodeURIComponent(`/opportunities/${post.slug}`)}`,
    );
    await page
      .getByLabel("Email address")
      .fill(`landing-${namespace}@ptahx.test`);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/opportunities/${post.slug}$`), {
      timeout: 60_000,
    });
    expect(
      (
        await database.query('SELECT id FROM "Session" WHERE "userId" = $1', [
          owner.id,
        ])
      ).rowCount,
    ).toBe(1);
    await page.goto("/");
    await expect(page).toHaveURL(/\/app$/);
    await expect(page.locator(`[data-post-id="${post.id}"]`)).toBeVisible();
    const response = await page.request.get("/api/home-feed");
    expect(response.status()).toBe(200);
    expect(
      (await response.json()).items.some(
        (item: { id: string }) => item.id === post.id,
      ),
    ).toBe(true);
  } finally {
    enforceTestDatabaseIsolation();
    try {
      await database.query('DELETE FROM "User" WHERE id = $1', [owner.id]);
    } finally {
      await database.end();
    }
  }
});
