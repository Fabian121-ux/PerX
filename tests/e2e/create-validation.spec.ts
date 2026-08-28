import { test, expect, type Page } from "@playwright/test";
import crypto from "node:crypto";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3100";
const TEST_DB = process.env.TEST_DATABASE_URL!;
const SESSION_COOKIE = process.env.SESSION_COOKIE_NAME ?? "perx_session";

/** alice holds CLIENT, which carries `opportunity:create`. */
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

/** Fill everything that is valid, leaving the caller to break one thing. */
async function fillValidBase(page: Page) {
  // Scoped to the form: a bare [name="description"] also matches the document's
  // <meta name="description"> tag.
  const form = page.locator("#create-post-form");
  await form
    .locator('input[name="title"]')
    .fill("Looking for a senior product designer for a fintech launch");
  await form
    .locator('[name="summary"]')
    .fill(
      "We need a designer to shape onboarding and the core dashboard experience.",
    );
  await form
    .locator('[name="description"]')
    .fill(
      "This engagement covers discovery, information architecture, interaction design and a component library handoff. ".repeat(
        2,
      ),
    );
}

test("an invalid budget names the exact field instead of a generic message", async ({
  browser,
}) => {
  const page = await browser.newPage({ viewport: { width: 390, height: 780 } });
  try {
    await signIn(page, "alice-test@perx.test");
    await page.goto(`${BASE}/app/opportunities/new`);
    await fillValidBase(page);

    // Open the disclosure holding the budget controls.
    const optional = page.getByRole("button", { name: /budget, location/i });
    if (await optional.count()) await optional.first().click();

    const budgetMin = page.locator('#create-post-form input[name="budgetMin"]');
    await budgetMin.fill("2,500");

    await page
      .getByRole("button", { name: /^publish/i })
      .first()
      .click();

    // The old behaviour was a redirect to ?error=check-fields with the opaque
    // "Please check your inputs and try again."
    const alert = page.locator('#create-post-form [role="alert"]');
    await expect(alert).toContainText(/needs your attention/i);
    await expect(alert).toContainText(/budget minimum/i);

    await expect(budgetMin).toHaveAttribute("aria-invalid", "true");
  } finally {
    await page.close();
  }
});

test("the invalid field keeps its value and receives focus", async ({
  browser,
}) => {
  const page = await browser.newPage({ viewport: { width: 390, height: 780 } });
  try {
    await signIn(page, "alice-test@perx.test");
    await page.goto(`${BASE}/app/opportunities/new`);
    await fillValidBase(page);

    const optional = page.getByRole("button", { name: /budget, location/i });
    if (await optional.count()) await optional.first().click();
    await page
      .locator('#create-post-form input[name="budgetMin"]')
      .fill("not-a-number");

    await page
      .getByRole("button", { name: /^publish/i })
      .first()
      .click();
    await expect(
      page.locator('#create-post-form [role="alert"]'),
    ).toBeVisible();

    // Re-entering work the user already did is the worst part of a rejected
    // submit, so the entered values must survive.
    await expect(
      page.locator('#create-post-form input[name="title"]'),
    ).toHaveValue(/product designer/i);
    await expect(
      page.locator('#create-post-form input[name="budgetMin"]'),
    ).toHaveValue("not-a-number");

    // Focus moves to the offending control, which also proves the collapsed
    // section was expanded - focusing a hidden input silently does nothing.
    await expect(
      page.locator('#create-post-form input[name="budgetMin"]'),
    ).toBeFocused();
  } finally {
    await page.close();
  }
});

test("a minimum above the maximum is reported on the maximum field", async ({
  browser,
}) => {
  const page = await browser.newPage({ viewport: { width: 390, height: 780 } });
  try {
    await signIn(page, "alice-test@perx.test");
    await page.goto(`${BASE}/app/opportunities/new`);
    await fillValidBase(page);

    const optional = page.getByRole("button", { name: /budget, location/i });
    if (await optional.count()) await optional.first().click();
    await page
      .locator('#create-post-form input[name="budgetMin"]')
      .fill("900000");
    await page
      .locator('#create-post-form input[name="budgetMax"]')
      .fill("1000");

    await page
      .getByRole("button", { name: /^publish/i })
      .first()
      .click();

    await expect(
      page.locator('#create-post-form [role="alert"]'),
    ).toContainText(/minimum budget cannot exceed maximum budget/i);
    await expect(
      page.locator('#create-post-form input[name="budgetMax"]'),
    ).toHaveAttribute("aria-invalid", "true");
  } finally {
    await page.close();
  }
});

test("no horizontal overflow while the error summary is shown", async ({
  browser,
}) => {
  for (const width of [320, 360, 375, 390, 412, 430]) {
    const page = await browser.newPage({ viewport: { width, height: 780 } });
    try {
      await signIn(page, "alice-test@perx.test");
      await page.goto(`${BASE}/app/opportunities/new`);
      await fillValidBase(page);

      const optional = page.getByRole("button", { name: /budget, location/i });
      if (await optional.count()) await optional.first().click();
      await page
        .locator('#create-post-form input[name="budgetMin"]')
        .fill("bad");
      await page
        .getByRole("button", { name: /^publish/i })
        .first()
        .click();
      await expect(
        page.locator('#create-post-form [role="alert"]'),
      ).toBeVisible();

      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      );
      expect(overflow, `composer overflows at ${width}px`).toBeLessThanOrEqual(
        1,
      );
    } finally {
      await page.close();
    }
  }
});
