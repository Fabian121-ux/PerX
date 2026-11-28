import { expect, test } from "@playwright/test";
import sharp from "sharp";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { enforceTestDatabaseIsolation } from "./utils/db-guard";

test("feed media and avatars load through the optimizer", async ({
  page,
}, testInfo) => {
  enforceTestDatabaseIsolation();
  const database = new Pool({
    connectionString: process.env.TEST_DATABASE_URL!,
    ssl: false,
  });
  const ownerId = randomUUID();
  const postId = randomUUID();
  try {
    await database.query(
      `INSERT INTO "User" (id,email,username,name,"passwordHash","imageUrl","accountClassification","updatedAt") VALUES ($1,$2,$3,'Image fixture member','disabled-image-fixture','/main_app_logo.png','PUBLIC_BETA_USER',NOW())`,
      [
        ownerId,
        `image-${ownerId}@ptahx.test`,
        `image_${ownerId.replaceAll("-", "").slice(0, 20)}`,
      ],
    );
    await database.query(
      `INSERT INTO "Profile" (id,"userId",headline,biography,location,"isDiscoverable","updatedAt") VALUES ($1,$2,'Image fixture','Isolated image acceptance','Test City',true,NOW())`,
      [randomUUID(), ownerId],
    );
    await database.query(
      `INSERT INTO "Opportunity" (id,"ownerId",type,status,"moderationStatus",title,slug,summary,description,"publishedAt","updatedAt") VALUES ($1,$2,'SERVICE','PUBLISHED','APPROVED','Image acceptance',$3,'Image acceptance','Isolated image fixture','2050-01-01',NOW())`,
      [postId, ownerId, `image-${postId}`],
    );
    await database.query(
      `INSERT INTO "OpportunityImage" (id,"opportunityId","uploaderId",url,"storageKey","mimeType","byteSize","isCover") VALUES ($1,$2,$3,'/main_app_logo.png',$4,'image/png',1,true)`,
      [randomUUID(), postId, ownerId, `fixture/${postId}`],
    );
    if (testInfo.project.name === "mobile-chrome")
      await page.setViewportSize({ width: 320, height: 740 });
    await page.goto("/");
    const card = page.locator(`[data-post-id="${postId}"]`);
    await expect(card).toBeVisible();
    const images = card.locator("img");
    await expect(images).toHaveCount(2);
    for (const image of await images.all()) {
      await expect(image).toBeVisible();
      await expect
        .poll(() =>
          image.evaluate(
            (el: HTMLImageElement) => el.complete && el.naturalWidth > 0,
          ),
        )
        .toBe(true);
      expect(
        await image.evaluate(
          (el: HTMLImageElement) => new URL(el.currentSrc).pathname,
        ),
      ).toBe("/_next/image");
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({ path: testInfo.outputPath("feed-images.png") });
  } finally {
    enforceTestDatabaseIsolation();
    try {
      await database.query('DELETE FROM "User" WHERE id = $1', [ownerId]);
    } finally {
      await database.end();
    }
  }
});

test("public routes render without errors or overflow after the framework upgrade", async ({
  page,
}, testInfo) => {
  if (testInfo.project.name === "mobile-chrome") {
    await page.setViewportSize({ width: 320, height: 740 });
  }
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const route of [
    "/",
    "/sign-in",
    "/sign-up",
    "/password-recovery",
    "/posts",
  ]) {
    const response = await page.goto(route);
    expect(response?.status(), route).toBe(200);
    await expect(page.locator("main")).toBeVisible();
    await expect(page.getByText(/temporarily unavailable/i)).toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      route,
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath(`${route.replaceAll("/", "") || "home"}.png`),
    });
  }
  await page.goto("/app");
  await expect(page).toHaveURL(/\/sign-in\?returnTo=%2Fapp$/);
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

for (const format of ["avif", "webp"] as const) {
  test(`image optimizer returns a decodable resized ${format}`, async ({
    request,
  }) => {
    const response = await request.get("/_next/image", {
      params: { url: "/main_app_logo.png", w: "64", q: "75" },
      headers: { Accept: `image/${format}` },
    });
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toBe(`image/${format}`);
    const decoded = sharp(await response.body());
    expect((await decoded.metadata()).width).toBe(64);
    expect((await decoded.raw().toBuffer()).length).toBeGreaterThan(0);
  });
}

test("image optimizer still rejects unapproved remote hosts", async ({
  request,
}) => {
  const response = await request.get("/_next/image", {
    params: {
      url: "https://unapproved.example.test/image.png",
      w: "64",
      q: "75",
    },
  });
  expect(response.status()).toBe(400);
});
