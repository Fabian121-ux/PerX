import crypto from "node:crypto";

import { test, expect, type Page } from "@playwright/test";

import { hasIsolatedTestDatabase } from "./utils/db-guard";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3100";
const TEST_DB = process.env.TEST_DATABASE_URL ?? "";
const SESSION_COOKIE = process.env.SESSION_COOKIE_NAME ?? "perx_session";

const describeOrSkip = hasIsolatedTestDatabase()
  ? test.describe
  : test.describe.skip;

type RouteFixture = {
  conversationId: string;
  dealId: string;
  escrowReason: string;
  messageBody: string;
  milestoneTitle: string;
  missingId: string;
  opportunityId: string;
  opportunityTitle: string;
  outsiderEmail: string;
  ownerEmail: string;
  providerEmail: string;
  userIds: string[];
};

describeOrSkip("Gated /app route status and loading proof", () => {
  const sessions = new Set<string>();
  let fixture: RouteFixture;

  type PgPool = Awaited<ReturnType<typeof createPool>>;

  async function createPool() {
    const { Pool } = await import("pg");
    return new Pool({ connectionString: TEST_DB, ssl: false });
  }

  async function withPool<T>(fn: (pool: PgPool) => Promise<T>): Promise<T> {
    const pool = await createPool();
    try {
      return await fn(pool);
    } finally {
      await pool.end();
    }
  }

  function testCuid() {
    return `c${crypto.randomBytes(12).toString("hex")}`;
  }

  async function createRouteFixture(): Promise<RouteFixture> {
    const suffix = crypto.randomBytes(8).toString("hex");
    const ownerId = testCuid();
    const providerId = testCuid();
    const outsiderId = testCuid();
    const ownerEmail = `route-owner-${suffix}@perx.test`;
    const providerEmail = `route-provider-${suffix}@perx.test`;
    const outsiderEmail = `route-outsider-${suffix}@perx.test`;
    const opportunityId = testCuid();
    const conversationId = testCuid();
    const proposalId = testCuid();
    const proposalVersionId = testCuid();
    const dealId = testCuid();
    const opportunityTitle = `Private route proof ${suffix}`;
    const messageBody = `Protected conversation proof ${suffix}`;
    const milestoneTitle = `Restricted milestone ${suffix}`;
    const escrowReason = `Restricted agreement history ${suffix}`;

    return withPool(async (pool) => {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query(
          `INSERT INTO "User" (
             id, email, "passwordHash", name, username, "emailVerifiedAt",
             "verificationStatus", "isActive", "onboardingDismissedAt",
             "createdAt", "updatedAt"
           ) VALUES
             ($1, $2, 'unused-route-proof-hash', 'Route Owner', $3, NOW(), 'VERIFIED', true, NOW(), NOW(), NOW()),
             ($4, $5, 'unused-route-proof-hash', 'Route Provider', $6, NOW(), 'VERIFIED', true, NOW(), NOW(), NOW()),
             ($7, $8, 'unused-route-proof-hash', 'Route Outsider', $9, NOW(), 'VERIFIED', true, NOW(), NOW(), NOW())`,
          [
            ownerId,
            ownerEmail,
            `route-owner-${suffix}`,
            providerId,
            providerEmail,
            `route-provider-${suffix}`,
            outsiderId,
            outsiderEmail,
            `route-outsider-${suffix}`,
          ],
        );
        await client.query(
          `INSERT INTO "Opportunity" (
             id, "ownerId", type, status, "moderationStatus", title, slug,
             summary, description, remote, currency, skills, "createdAt", "updatedAt"
           ) VALUES (
             $1, $2, 'SERVICE', 'DRAFT', 'APPROVED', $3, $4,
             'Private owner-only route proof', 'Private route proof description',
             true, 'NGN', ARRAY['route-proof']::text[], NOW(), NOW()
           )`,
          [
            opportunityId,
            ownerId,
            opportunityTitle,
            `private-route-proof-${suffix}`,
          ],
        );
        await client.query(
          `INSERT INTO "Conversation" (id, status, "createdAt", "updatedAt")
           VALUES ($1, 'ACTIVE', NOW(), NOW())`,
          [conversationId],
        );
        await client.query(
          `INSERT INTO "ConversationParticipant" (
             id, "conversationId", "userId", "removedAt", "createdAt"
           ) VALUES
             ($1, $2, $3, NULL, NOW()),
             ($4, $2, $5, NULL, NOW())`,
          [testCuid(), conversationId, ownerId, testCuid(), providerId],
        );
        await client.query(
          `INSERT INTO "Message" (
             id, "conversationId", "senderId", body, "createdAt"
           ) VALUES ($1, $2, $3, $4, NOW())`,
          [testCuid(), conversationId, providerId, messageBody],
        );
        await client.query(
          `INSERT INTO "Proposal" (
             id, "opportunityId", "senderId", "conversationId", status,
             "amountMinor", currency, description, "deliveryDays", revisions,
             "createdAt", "updatedAt"
           ) VALUES (
             $1, $2, $3, $4, 'DRAFT', 125000, 'NGN',
             'Private route proof proposal', 7, 1, NOW(), NOW()
           )`,
          [proposalId, opportunityId, providerId, conversationId],
        );
        await client.query(
          `INSERT INTO "ProposalVersion" (
             id, "proposalId", "versionNumber", status, "amountMinor",
             currency, description, "deliveryDays", "includedRevisions",
             "createdById", "createdAt", "updatedAt"
           ) VALUES (
             $1, $2, 1, 'DRAFT', 125000, 'NGN',
             'Private route proof proposal', 7, 1, $3, NOW(), NOW()
           )`,
          [proposalVersionId, proposalId, providerId],
        );
        await client.query(
          `INSERT INTO "Deal" (
             id, "proposalId", "proposalVersionId", "opportunityId", status,
             "settlementMode", "valueMinor", currency, "createdAt", "updatedAt"
           ) VALUES (
             $1, $2, $3, $4, 'IN_PROGRESS', 'PROVIDER_DISABLED',
             125000, 'NGN', NOW(), NOW()
           )`,
          [dealId, proposalId, proposalVersionId, opportunityId],
        );
        await client.query(
          `INSERT INTO "DealParticipant" (
             id, "dealId", "userId", role, "createdAt"
           ) VALUES
             ($1, $2, $3, 'client', NOW()),
             ($4, $2, $5, 'provider', NOW())`,
          [testCuid(), dealId, ownerId, testCuid(), providerId],
        );
        await client.query(
          `INSERT INTO "DealMilestone" (
             id, "dealId", title, description, "amountMinor", currency,
             status, "createdAt"
           ) VALUES (
             $1, $2, $3, 'Private milestone details', 125000, 'NGN',
             'IN_PROGRESS', NOW()
           )`,
          [testCuid(), dealId, milestoneTitle],
        );
        await client.query(
          `INSERT INTO "EscrowStatusHistory" (
             id, "dealId", "fromStatus", "toStatus", "actorId", reason,
             "createdAt"
           ) VALUES ($1, $2, NULL, 'IN_PROGRESS', $3, $4, NOW())`,
          [testCuid(), dealId, ownerId, escrowReason],
        );
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }

      return {
        conversationId,
        dealId,
        escrowReason,
        messageBody,
        milestoneTitle,
        missingId: testCuid(),
        opportunityId,
        opportunityTitle,
        outsiderEmail,
        ownerEmail,
        providerEmail,
        userIds: [ownerId, providerId, outsiderId],
      };
    });
  }

  async function deleteRouteFixture() {
    const sessionIds = [...sessions];
    sessions.clear();
    await withPool(async (pool) => {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        if (sessionIds.length) {
          await client.query(
            `DELETE FROM "Session" WHERE id = ANY($1::text[])`,
            [sessionIds],
          );
        }
        await client.query(`DELETE FROM "Deal" WHERE id = $1`, [
          fixture.dealId,
        ]);
        await client.query(`DELETE FROM "Conversation" WHERE id = $1`, [
          fixture.conversationId,
        ]);
        await client.query(`DELETE FROM "Opportunity" WHERE id = $1`, [
          fixture.opportunityId,
        ]);
        await client.query(`DELETE FROM "User" WHERE id = ANY($1::text[])`, [
          fixture.userIds,
        ]);
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    });
  }

  async function login(page: Page, email: string) {
    await withPool(async (pool) => {
      const user = await pool.query<{ id: string }>(
        `SELECT id FROM "User" WHERE email = $1`,
        [email],
      );
      if (!user.rows[0]) throw new Error(`Route proof user ${email} not found`);

      const token = crypto.randomBytes(32).toString("base64url");
      const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
      const sessionId = `sess_${crypto.randomUUID()}`;
      await pool.query(
        `INSERT INTO "Session" (
           id, "tokenHash", "userId", "expiresAt", "createdAt", "lastSeenAt"
         ) VALUES ($1, $2, $3, $4, NOW(), NOW())`,
        [
          sessionId,
          tokenHash,
          user.rows[0].id,
          new Date(Date.now() + 3600_000),
        ],
      );
      sessions.add(sessionId);
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
    });
  }

  async function expectStatus(
    page: Page,
    path: string,
    status: 200 | 404,
    label: string,
  ) {
    const response = await page.goto(`${BASE}${path}`);
    expect(response, label).not.toBeNull();
    expect(response!.status(), label).toBe(status);
  }

  test.beforeAll(async () => {
    fixture = await createRouteFixture();
  });

  test.afterAll(async () => {
    if (fixture) await deleteRouteFixture();
  });

  test("conversation returns authorized 200, missing 404, and unauthorized 404 without disclosure", async ({
    page,
  }) => {
    await login(page, fixture.ownerEmail);
    await expectStatus(
      page,
      `/app/messages/${fixture.conversationId}`,
      200,
      "authorized conversation",
    );
    await expect(
      page
        .getByLabel("Message history")
        .getByText(fixture.messageBody, { exact: true }),
    ).toBeVisible();

    await expectStatus(
      page,
      `/app/messages/${fixture.missingId}`,
      404,
      "missing conversation",
    );

    await page.context().clearCookies();
    await login(page, fixture.outsiderEmail);
    await expectStatus(
      page,
      `/app/messages/${fixture.conversationId}`,
      404,
      "unauthorized conversation",
    );
    await expect(page.locator("body")).not.toContainText(fixture.messageBody);
    await expect(page.getByRole("button", { name: "Make a Deal" })).toHaveCount(
      0,
    );
  });

  test("opportunity preview and edit each return 200/404/404", async ({
    page,
  }) => {
    const previewPath = `/app/opportunities/${fixture.opportunityId}`;
    const editPath = `${previewPath}/edit`;
    const paths = [previewPath, editPath];
    const missingPaths = [
      `/app/opportunities/${fixture.missingId}`,
      `/app/opportunities/${fixture.missingId}/edit`,
    ];

    await login(page, fixture.ownerEmail);
    await expectStatus(page, previewPath, 200, `authorized ${previewPath}`);
    await expect(page.locator("main")).toContainText(fixture.opportunityTitle);
    await expectStatus(page, editPath, 200, `authorized ${editPath}`);
    await expect(page.getByLabel("Title")).toHaveValue(
      fixture.opportunityTitle,
    );

    for (const path of missingPaths) {
      await expectStatus(page, path, 404, `missing ${path}`);
    }

    await page.context().clearCookies();
    await login(page, fixture.outsiderEmail);
    for (const path of paths) {
      await expectStatus(page, path, 404, `unauthorized ${path}`);
      await expect(page.locator("body")).not.toContainText(
        fixture.opportunityTitle,
      );
    }
  });

  test("all four deal routes each return 200/404/404 without disclosure", async ({
    page,
  }) => {
    // Twelve full navigations against a dev server that compiles on demand.
    // The default 90s budget is a harness limit, not a product expectation.
    test.setTimeout(180_000);
    const routes = [
      { sentinel: fixture.opportunityTitle, suffix: "" },
      { sentinel: fixture.milestoneTitle, suffix: "/milestones" },
      { sentinel: fixture.escrowReason, suffix: "/escrow" },
      { sentinel: fixture.milestoneTitle, suffix: "/deliveries" },
    ];

    await login(page, fixture.providerEmail);
    for (const route of routes) {
      const path = `/app/deals/${fixture.dealId}${route.suffix}`;
      await expectStatus(page, path, 200, `authorized ${path}`);
      await expect(page.locator("main")).toContainText(route.sentinel);
    }

    for (const route of routes) {
      const path = `/app/deals/${fixture.missingId}${route.suffix}`;
      await expectStatus(page, path, 404, `missing ${path}`);
    }

    await page.context().clearCookies();
    await login(page, fixture.outsiderEmail);
    for (const route of routes) {
      const path = `/app/deals/${fixture.dealId}${route.suffix}`;
      await expectStatus(page, path, 404, `unauthorized ${path}`);
      await expect(page.locator("body")).not.toContainText(route.sentinel);
    }
  });

  test("valid non-gated navigation streams scoped loading feedback", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await page.addInitScript(() => {
      class NoopIntersectionObserver implements IntersectionObserver {
        readonly root = null;
        readonly rootMargin = "0px";
        readonly thresholds = [0];

        disconnect() {}
        observe() {}
        takeRecords() {
          return [];
        }
        unobserve() {}
      }

      Object.defineProperty(window, "IntersectionObserver", {
        configurable: true,
        value: NoopIntersectionObserver,
      });
    });
    await login(page, fixture.ownerEmail);

    // Compile the destination in an isolated page so cold development builds do
    // not delay the RSC response that carries the loading boundary.
    const warmupPage = await page.context().newPage();
    try {
      const response = await warmupPage.goto(`${BASE}/app/appeals`);
      expect(response?.status(), "appeals warmup route").toBe(200);
    } finally {
      await warmupPage.close();
    }

    const { Client } = await import("pg");
    const client = new Client({ connectionString: TEST_DB, ssl: false });
    await client.connect();

    try {
      const response = await page.goto(`${BASE}/app/settings`);
      expect(response?.status(), "settings route").toBe(200);
      await expect(
        page.getByRole("heading", { name: "Account settings" }),
      ).toBeVisible();
      const loading = page.getByLabel("Loading workspace");
      await expect(loading).toBeHidden();

      await client.query("BEGIN");
      await client.query(
        `LOCK TABLE "EnforcementAction" IN ACCESS EXCLUSIVE MODE`,
      );
      const appealsLink = page.getByRole("link", { name: "View appeals" });
      await appealsLink.focus();
      const navigation = page.keyboard.press("Enter");
      await expect(loading).toBeVisible({ timeout: 15_000 });
      await expect(loading).toHaveAttribute("aria-busy", "true");

      await client.query("ROLLBACK");
      await navigation;
      await expect(page).toHaveURL(/\/app\/appeals$/);
      await expect(
        page.getByRole("heading", { name: "Appeals", exact: true }),
      ).toBeVisible();
      await expect(loading).toBeHidden();
    } finally {
      await client.query("ROLLBACK").catch(() => undefined);
      await client.end();
    }
  });
});
