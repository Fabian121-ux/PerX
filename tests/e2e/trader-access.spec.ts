import { test, expect, type Page } from "@playwright/test";
import crypto from "node:crypto";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3100";
const TEST_DB = process.env.TEST_DATABASE_URL!;
const SESSION_COOKIE = process.env.SESSION_COOKIE_NAME ?? "perx_session";

/** carol is a MEMBER: no `opportunity:create`. alice holds CLIENT. */
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

test("a non-trader gets the Trader gate, not a 404", async ({ browser }) => {
  const page = await browser.newPage({ viewport: { width: 390, height: 780 } });
  try {
    await signIn(page, "carol-test@perx.test");
    const response = await page.goto(`${BASE}/app/opportunities/new`);

    // The route exists and the user is signed in; telling them the page is not
    // available was both untrue and a dead end.
    expect(response?.status()).toBe(200);
    await expect(
      page.getByRole("heading", { name: /become a trader/i }),
    ).toBeVisible();
    await expect(
      page.getByText(/this perx page is not available/i),
    ).toHaveCount(0);

    await expect(
      page.getByRole("link", { name: /become a trader/i }),
    ).toBeVisible();
  } finally {
    await page.close();
  }
});

test("the protected composer is never sent to a non-trader", async ({
  browser,
}) => {
  const page = await browser.newPage();
  try {
    await signIn(page, "carol-test@perx.test");
    await page.goto(`${BASE}/app/opportunities/new`);

    // Gating must not be cosmetic: the form must be absent from the payload,
    // not merely hidden with CSS.
    await expect(page.locator("#create-post-form")).toHaveCount(0);
    await expect(page.locator('[name="budgetMin"]')).toHaveCount(0);

    const markup = await page.content();
    expect(markup).not.toContain("create-post-form");
  } finally {
    await page.close();
  }
});

test("a trader still reaches the real composer", async ({ browser }) => {
  const page = await browser.newPage({ viewport: { width: 390, height: 780 } });
  try {
    await signIn(page, "alice-test@perx.test");
    const response = await page.goto(`${BASE}/app/opportunities/new`);

    expect(response?.status()).toBe(200);
    await expect(page.locator("#create-post-form")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /become a trader/i }),
    ).toHaveCount(0);
  } finally {
    await page.close();
  }
});

for (const width of [320, 360, 375, 390, 412, 430]) {
  test(`Create is reachable for a non-trader at ${width}px`, async ({
    browser,
  }) => {
    const page = await browser.newPage({ viewport: { width, height: 780 } });
    try {
      await signIn(page, "carol-test@perx.test");
      await page.goto(`${BASE}/app`);

      // Discoverability must not depend on viewport width or on role.
      const create = page.getByRole("link", { name: "Create", exact: true });
      await expect(create.first()).toBeVisible();

      const box = await create.first().boundingBox();
      expect(box, "Create has no layout box").not.toBeNull();
      expect(
        box!.height,
        `touch target too small at ${width}px`,
      ).toBeGreaterThanOrEqual(40);

      await create.first().click();
      // The destination is compiled and rendered on demand; the assertion waits
      // for that navigation rather than assuming the default 5s is enough.
      await expect(
        page.getByRole("heading", { name: /become a trader/i }),
      ).toBeVisible({ timeout: 30_000 });

      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      );
      expect(
        overflow,
        `trader gate overflows at ${width}px`,
      ).toBeLessThanOrEqual(1);
    } finally {
      await page.close();
    }
  });
}

test("Create is visible to a trader on a small phone", async ({ browser }) => {
  const page = await browser.newPage({ viewport: { width: 320, height: 780 } });
  try {
    await signIn(page, "alice-test@perx.test");
    await page.goto(`${BASE}/app`);

    const create = page.getByRole("link", { name: "Create", exact: true });
    await expect(create.first()).toBeVisible();
    await create.first().click();

    await expect(page.locator("#create-post-form")).toBeVisible({
      timeout: 30_000,
    });
  } finally {
    await page.close();
  }
});
