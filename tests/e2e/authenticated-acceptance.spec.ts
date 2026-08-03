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
    expect(labels).toEqual([
      "Connections",
      "Create Post",
      "Home",
      "Messages",
      "Profile",
    ]);
    await expect(links.nth(2)).toHaveAttribute("aria-label", "Home");
    await page.close();
  });

  test("feature directory keeps search visible without forcing focus", async ({ browser }) => {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await createSession(page, "alice-test@perx.test");
    await page.goto(`${BASE}/app`);
    await page.getByRole("button", { name: "Open PerX feature directory" }).click();

    const search = page.getByLabel("Search PerX features");
    const close = page.getByRole("button", { name: "Close feature directory" });
    await expect(search).toBeVisible();
    await expect(close).toBeFocused();
    await expect(search).not.toBeFocused();
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

    const composer = page.getByRole("textbox", { name: "Message", exact: true });
    await composer.fill("Keyboard contract check");
    await composer.press("Enter");
    await expect(composer).toHaveValue("Keyboard contract check\n");
    await composer.press("Control+Enter");
    await expect(composer).toHaveValue("");
    await expect(
      page
        .locator("[data-message-id]")
        .getByText("Keyboard contract check", { exact: true })
        .last(),
    ).toBeVisible();

    const conversationSearch = page.getByPlaceholder(
      "Search people or conversations",
    );
    await conversationSearch.fill("No matching participant 404");
    await expect(page.getByText("No conversations found")).toBeVisible();
    await page.close();
  });

  test("draft proposal becomes a locked version and an exact-version Deal", async ({ browser }) => {
    test.setTimeout(180_000);
    const scope = `Acceptance flow ${Date.now()} with locked scope, delivery criteria, and a numbered revision history.`;
    const alicePage = await browser.newPage();
    await createSession(alicePage, "alice-test@perx.test");
    await alicePage.goto(`${BASE}/opportunities/bob-mech-keyboard`);
    await alicePage.getByLabel("Proposed amount").fill("250000.00");
    await alicePage.getByLabel("Delivery period").fill("10");
    await alicePage.getByLabel("Revisions").fill("2");
    await alicePage.getByLabel("Proposal").fill(scope);
    const saveDraftButton = alicePage.getByRole("button", { name: "Save draft" });
    const proposalForm = saveDraftButton.locator("xpath=ancestor::form[1]");
    expect(await proposalForm.evaluate((form: HTMLFormElement) => form.checkValidity())).toBe(true);
    const draftResponsePromise = alicePage.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        response.url().includes("/opportunities/bob-mech-keyboard"),
    );
    await saveDraftButton.click();
    const draftResponse = await draftResponsePromise;
    expect(draftResponse.status()).toBeLessThan(400);
    await expect(alicePage).toHaveURL(/\/app\/proposals\/sent/);
    await alicePage.waitForLoadState("networkidle");
    const draftEditor = alicePage
      .getByRole("textbox", { name: "Scope and acceptance details" })
      .first();
    await expect(draftEditor).toHaveValue(scope);
    const sentProposalCard = draftEditor.locator("xpath=ancestor::section[1]");
    const submitResponsePromise = alicePage.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        response.url().includes("/app/proposals/sent"),
    );
    await sentProposalCard
      .getByRole("button", { name: /Submit and lock v/ })
      .click();
    expect((await submitResponsePromise).status()).toBeLessThan(400);
    await expect(alicePage).toHaveURL(/\/app\/messages\//, {
      timeout: 30_000,
    });
    await expect(alicePage.getByText(scope, { exact: true })).toBeVisible();
    await expect(
      alicePage.getByText(/submitted version is locked/i),
    ).toBeVisible();
    await alicePage.goto(`${BASE}/app/proposals/sent`);
    await alicePage.waitForLoadState("networkidle");
    const lockedProposalCard = alicePage
      .getByText(scope, { exact: true })
      .locator("xpath=ancestor::section[1]");
    const createRevisionButton = lockedProposalCard.getByRole("button", {
      name: "Create revision",
    });
    const revisionRequestPromise = alicePage.waitForRequest(
      (request) =>
        request.method() === "POST" &&
        request.url().includes("/app/proposals/sent"),
    );
    await createRevisionButton.evaluate((button: HTMLButtonElement) => {
      button.form?.requestSubmit(button);
    });
    expect((await (await revisionRequestPromise).response())?.status()).toBeLessThan(400);
    const revisionEditor = alicePage
      .getByRole("textbox", { name: "Scope and acceptance details" })
      .first();
    await expect(revisionEditor).toHaveValue(scope, { timeout: 30_000 });
    await expect(
      revisionEditor
        .locator("xpath=ancestor::section[1]")
        .getByText("Editable draft · v2"),
    ).toBeVisible();
    await alicePage.close();

    const bobPage = await browser.newPage();
    await createSession(bobPage, "bob-test@perx.test");
    await bobPage.goto(`${BASE}/app/proposals/received`);
    await bobPage.waitForLoadState("networkidle");
    await expect(bobPage.getByText(scope, { exact: true })).toHaveCount(1);
    const proposalCard = bobPage
      .getByText(scope, { exact: true })
      .locator("xpath=ancestor::section[1]");
    const acceptButton = proposalCard.getByRole("button", {
      name: "Accept exact version",
    });
    const formMetadata = await acceptButton.evaluate((button: HTMLButtonElement) => ({
      action: button.form?.getAttribute("action"),
      fieldNames: button.form
        ? [...new FormData(button.form).keys()]
        : [],
      hasForm: Boolean(button.form),
      method: button.form?.method,
    }));
    expect(formMetadata.hasForm).toBe(true);
    expect(formMetadata.method).toBe("post");
    expect(formMetadata.fieldNames).toContain("versionId");
    expect(
      formMetadata.fieldNames.some((name) => name.startsWith("$ACTION_ID_")),
    ).toBe(true);
    const acceptRequestPromise = bobPage.waitForRequest(
      (request) =>
        request.method() === "POST" &&
        request.url().includes("/app/proposals/received"),
      { timeout: 30_000 },
    );
    await acceptButton.evaluate((button: HTMLButtonElement) => {
      button.form?.requestSubmit(button);
    });
    const acceptResponse = await (await acceptRequestPromise).response();
    expect(acceptResponse?.status()).toBeLessThan(400);
    await expect(bobPage).toHaveURL(/\/app\/deals\//, { timeout: 30_000 });
    await expect(bobPage.getByText("Online payment unavailable")).toBeVisible();
    await expect(bobPage.getByText(/does not collect or hold funds/i)).toBeVisible();
    const dealUrl = bobPage.url();

    await bobPage.goto(`${BASE}/app/proposals/received`);
    await expect(bobPage.getByText(scope, { exact: true })).toHaveCount(1);

    await bobPage.goto(`${dealUrl}/deliveries`);
    await expect(
      bobPage.getByText("Only the assigned provider can submit milestone work."),
    ).toBeVisible();

    const aliceDeliveryPage = await browser.newPage();
    await createSession(aliceDeliveryPage, "alice-test@perx.test");
    await aliceDeliveryPage.goto(`${dealUrl}/deliveries`);
    await aliceDeliveryPage.waitForLoadState("networkidle");
    await aliceDeliveryPage.getByLabel("Title").fill("Acceptance delivery");
    await aliceDeliveryPage
      .getByLabel("Notes")
      .fill("Completed the exact locked scope for the acceptance test.");
    const submitDeliveryButton = aliceDeliveryPage.getByRole("button", {
      name: "Submit delivery",
    });
    const deliveryRequestPromise = aliceDeliveryPage.waitForRequest(
      (request) =>
        request.method() === "POST" && request.url().includes("/deliveries"),
    );
    await submitDeliveryButton.evaluate((button: HTMLButtonElement) => {
      button.form?.requestSubmit(button);
    });
    expect((await (await deliveryRequestPromise).response())?.status()).toBeLessThan(400);
    await expect(aliceDeliveryPage).toHaveURL(new RegExp(`${dealUrl}$`), {
      timeout: 30_000,
    });
    await aliceDeliveryPage.close();

    await bobPage.goto(`${dealUrl}/deliveries`);
    await bobPage.waitForLoadState("networkidle");
    const approveButton = bobPage.getByRole("button", {
      name: "Approve submitted milestone",
    });
    const approvalRequestPromise = bobPage.waitForRequest(
      (request) =>
        request.method() === "POST" && request.url().includes("/deliveries"),
    );
    await approveButton.evaluate((button: HTMLButtonElement) => {
      button.form?.requestSubmit(button);
    });
    expect((await (await approvalRequestPromise).response())?.status()).toBeLessThan(400);
    await expect(bobPage).toHaveURL(new RegExp(`${dealUrl}$`), {
      timeout: 30_000,
    });

    const dealId = new URL(dealUrl).pathname.split("/").at(-1)!;
    const { Pool } = await import("pg");
    const pool = new Pool({ connectionString: TEST_DB, ssl: false });
    try {
      const result = await pool.query(
        `SELECT d.status,
                d."settlementMode",
                COUNT(DISTINCT r.id)::int AS releases,
                ARRAY_AGG(DISTINCT v.status::text) AS version_statuses
         FROM "Deal" d
         LEFT JOIN "Release" r ON r."dealId" = d.id
         JOIN "ProposalVersion" v ON v."proposalId" = d."proposalId"
         WHERE d.id = $1
         GROUP BY d.id`,
        [dealId],
      );
      expect(result.rows[0]).toMatchObject({
        releases: 0,
        settlementMode: "PROVIDER_DISABLED",
        status: "APPROVED",
      });
      expect(result.rows[0].version_statuses).toEqual(
        expect.arrayContaining(["ACCEPTED", "WITHDRAWN"]),
      );
    } finally {
      await pool.end();
    }
    await bobPage.close();
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
