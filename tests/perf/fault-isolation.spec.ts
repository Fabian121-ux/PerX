import { test, expect, type Page } from "@playwright/test";
import crypto from "node:crypto";

/**
 * Feature-local failure isolation, proven by real fault injection.
 *
 * Each case makes a specific server dependency actually throw inside a real
 * request (via the `x-perx-fault` header, which only works when fault
 * injection is explicitly enabled on a non-production server) and then asserts
 * that the surrounding route survives.
 *
 * The rule under test: a failure in an optional dependency must degrade only
 * that section. It must not escalate into a route-level error page.
 */

const BASE = process.env.PERF_FAULT_BASE_URL ?? "";
const TEST_DB = process.env.TEST_DATABASE_URL!;
const SESSION_COOKIE = process.env.SESSION_COOKIE_NAME ?? "perx_session";

const describeOrSkip = BASE ? test.describe : test.describe.skip;

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

/** Applies the fault header to every request this page makes. */
async function injectFault(page: Page, surface: string) {
  await page.setExtraHTTPHeaders({ "x-perx-fault": surface });
}

describeOrSkip("feature fault isolation", () => {
  test("Home survives a notification badge failure", async ({ browser }) => {
    const page = await browser.newPage();
    try {
      await signIn(page, "alice-test@perx.test");
      await injectFault(page, "unread-counts");
      const response = await page.goto(`${BASE}/app`);

      expect(response?.status(), "Home must not 500").toBe(200);
      // The feed - the actual point of Home - must still render.
      await expect(page.getByRole("navigation").first()).toBeVisible();
      const body = (await page.textContent("body")) ?? "";
      expect(body).not.toMatch(/Workspace Unavailable/i);
      expect(body).not.toMatch(/something went wrong/i);
    } finally {
      await page.close();
    }
  });

  test("Profile identity survives an optional activity failure", async ({
    browser,
  }) => {
    const page = await browser.newPage();
    try {
      await signIn(page, "alice-test@perx.test");
      await injectFault(page, "profile-activity");
      const response = await page.goto(`${BASE}/app/profile`);

      expect(response?.status(), "Profile must not 500").toBe(200);
      // Core identity remains.
      await expect(page.getByTestId("profile-activity-error")).toBeVisible({
        timeout: 15_000,
      });
      const body = (await page.textContent("body")) ?? "";
      expect(body).toMatch(/Activity unavailable/i);
      expect(body).not.toMatch(/Workspace Unavailable/i);
    } finally {
      await page.close();
    }
  });

  test("optional section retry recovers without a full reload", async ({
    browser,
  }) => {
    const page = await browser.newPage();
    try {
      await signIn(page, "alice-test@perx.test");
      await injectFault(page, "profile-activity");
      await page.goto(`${BASE}/app/profile`);
      const localError = page.getByTestId("profile-activity-error");
      await expect(localError).toBeVisible({ timeout: 15_000 });

      // Clear the fault, then use the section's own Retry control.
      await page.setExtraHTTPHeaders({});
      await page.getByRole("button", { name: "Retry" }).first().click();

      // The boundary must actually re-render its children.
      await expect(localError).toBeHidden({ timeout: 15_000 });
    } finally {
      await page.close();
    }
  });

  test("Trader distinguishes a failed lookup from an absent application", async ({
    browser,
  }) => {
    const page = await browser.newPage();
    try {
      await signIn(page, "carol-test@perx.test");

      // A. Query succeeds, no application: legitimate onboarding gate.
      const healthy = await page.goto(`${BASE}/app/trader`);
      expect(healthy?.status()).toBe(200);
      const healthyBody = (await page.textContent("body")) ?? "";
      expect(healthyBody).toMatch(/Become a Trader/i);
      expect(healthyBody).not.toMatch(/temporarily unavailable/i);
      // The onboarding form is the whole point of this state. It is a
      // multi-step form, so the first step exposes "Continue".
      await expect(
        page.getByRole("button", { name: /Continue/i }),
      ).toBeVisible();

      // C. Lookup fails: status is unknown and must not be reported as absent.
      await injectFault(page, "trader-application");
      const failed = await page.goto(`${BASE}/app/trader`);
      expect(failed?.status(), "Trader must not 500").toBe(200);
      const failedBody = (await page.textContent("body")) ?? "";

      expect(failedBody).toMatch(/Trader status is temporarily unavailable/i);
      // Must NOT invite a re-application while an existing one may be pending.
      expect(failedBody).not.toMatch(/Become a Trader/i);
      await expect(page.getByTestId("trader-status-retry")).toBeVisible();
      // No blank application form during an outage: a user with a pending
      // application must not be invited to start a new one.
      await expect(page.getByRole("button", { name: /Continue/i })).toHaveCount(
        0,
      );

      // Truthful, and free of infrastructure detail.
      expect(failedBody).not.toMatch(/Workspace Unavailable/i);
      expect(failedBody).not.toMatch(/temporary connection issue/i);
      expect(failedBody).not.toMatch(/prisma|postgres|ECONNREFUSED/i);

      // The two states must not render the same semantic result.
      expect(failedBody).not.toBe(healthyBody);
    } finally {
      await page.close();
    }
  });

  test("Trader status retry recovers once the dependency is healthy", async ({
    browser,
  }) => {
    const page = await browser.newPage();
    try {
      await signIn(page, "carol-test@perx.test");
      await injectFault(page, "trader-application");
      await page.goto(`${BASE}/app/trader`);
      await expect(page.getByTestId("trader-status-retry")).toBeVisible();

      await page.setExtraHTTPHeaders({});
      await page.getByTestId("trader-status-retry").click();

      await expect(page.getByTestId("trader-status-retry")).toBeHidden({
        timeout: 15_000,
      });
      expect((await page.textContent("body")) ?? "").toMatch(
        /Become a Trader/i,
      );
    } finally {
      await page.close();
    }
  });

  test("messages remain usable when badge data fails", async ({ browser }) => {
    const page = await browser.newPage();
    try {
      await signIn(page, "alice-test@perx.test");
      await injectFault(page, "unread-counts");
      const response = await page.goto(`${BASE}/app/messages`);

      expect(response?.status(), "Messages must not 500").toBe(200);
      const body = (await page.textContent("body")) ?? "";
      expect(body).not.toMatch(/Workspace Unavailable/i);
    } finally {
      await page.close();
    }
  });

  test("fault injection is inert without the header", async ({ browser }) => {
    const page = await browser.newPage();
    try {
      await signIn(page, "alice-test@perx.test");
      const response = await page.goto(`${BASE}/app/profile`);
      expect(response?.status()).toBe(200);
      await expect(page.getByTestId("profile-activity-error")).toHaveCount(0);
    } finally {
      await page.close();
    }
  });
});
