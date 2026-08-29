import { test, expect, type Page } from "@playwright/test";
import crypto from "node:crypto";

/**
 * Production-mode user-perceived latency measurements.
 *
 * These are MEASUREMENTS, not pass/fail assertions. They deliberately avoid
 * asserting wall-clock thresholds, which would be hardware dependent. The
 * assertions present only confirm the flow actually reached the state being
 * timed, so a number is never reported for an interaction that silently
 * failed.
 *
 * Every measurement separates:
 *   ack      - first visual acknowledgement of the click
 *   content  - useful content visible
 *   settled  - server operation observably complete
 */

const BASE = process.env.PERF_BASE_URL ?? "http://127.0.0.1:3200";
const TEST_DB = process.env.TEST_DATABASE_URL!;
const SESSION_COOKIE = process.env.SESSION_COOKIE_NAME ?? "perx_session";

const results: Record<string, Record<string, number>> = {};

function record(flow: string, metric: string, ms: number) {
  (results[flow] ??= {})[metric] = Math.round(ms);
}

async function signIn(page: Page, email: string) {
  const { Pool } = await import("pg");
  const pool = new Pool({ connectionString: TEST_DB, ssl: false });
  try {
    const user = await pool.query<{ id: string }>(
      `SELECT id FROM "User" WHERE email = $1`,
      [email],
    );
    if (!user.rows[0]) throw new Error(`perf fixture user missing: ${email}`);
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

test.afterAll(() => {
  console.log("\n=== PERF RESULTS (JSON) ===");
  console.log(JSON.stringify(results, null, 2));
  console.log("=== END PERF RESULTS ===\n");
});

for (const width of [375, 390, 430, 1280]) {
  test(`conversation switch and chat profile preview @${width}px`, async ({
    browser,
  }) => {
    const page = await browser.newPage({ viewport: { width, height: 800 } });
    try {
      await signIn(page, "alice-test@perx.test");

      // --- Messages route open ---
      let t = performance.now();
      await page.goto(`${BASE}/app/messages`);
      await expect(page.getByLabel("Message workspace")).toBeVisible();
      record(`messages-open@${width}`, "content", performance.now() - t);

      // --- Conversation A open ---
      const items = page.locator("button[data-conversation-id]");
      const count = await items.count();
      if (count >= 2) {
        t = performance.now();
        await items.nth(0).click();
        await expect(page.getByLabel("Message history")).toBeVisible();
        record(`conversation-open@${width}`, "content", performance.now() - t);

        // --- Switch A -> B ---
        // On mobile the conversation view is immersive and covers the list, so
        // the real user path is Back, then select B. Measuring a direct click
        // on a covered element would measure the harness, not the product.
        const back = page.getByRole("button", {
          name: "Back to conversations",
        });
        if (await back.isVisible().catch(() => false)) {
          const tb = performance.now();
          await back.click();
          await expect(items.nth(1)).toBeVisible({ timeout: 15_000 });
          record(
            `conversation-back@${width}`,
            "content",
            performance.now() - tb,
          );
        }

        t = performance.now();
        await items.nth(1).click();
        await expect(items.nth(1)).toHaveAttribute("aria-current", "true", {
          timeout: 15_000,
        });
        record(`conversation-switch@${width}`, "ack", performance.now() - t);
        await expect(page.getByLabel("Message history")).toBeVisible({
          timeout: 15_000,
        });
        record(
          `conversation-switch@${width}`,
          "content",
          performance.now() - t,
        );
      }

      // --- Profile preview from chat ---
      const details = page.getByRole("button", {
        name: "Open conversation details",
      });
      if (await details.count()) {
        t = performance.now();
        await details.first().click();
        const dialog = page.getByRole("dialog", { name: "Profile preview" });
        await expect(dialog).toBeVisible({ timeout: 15_000 });
        record(`profile-preview@${width}`, "ack", performance.now() - t);
        await expect(
          dialog.locator('[data-profile-preview-scroll="true"]'),
        ).toBeVisible();
        record(`profile-preview@${width}`, "content", performance.now() - t);
        await dialog
          .getByRole("button", { name: "Close profile preview" })
          .click();
      }
    } finally {
      await page.close();
    }
  });
}

test("Create gate (non-Trader) and Create form (Trader)", async ({
  browser,
}) => {
  for (const [label, email] of [
    ["non-trader", "carol-test@perx.test"],
    ["trader", "alice-test@perx.test"],
  ] as const) {
    const page = await browser.newPage({
      viewport: { height: 800, width: 390 },
    });
    try {
      await signIn(page, email);
      await page.goto(`${BASE}/app`);
      const create = page.getByRole("link", { name: "Create", exact: true });
      await expect(create.first()).toBeVisible();

      const t = performance.now();
      await create.first().click();
      if (label === "non-trader") {
        await expect(
          page.getByRole("heading", { name: /become a trader/i }),
        ).toBeVisible({ timeout: 20_000 });
        record("create-gate-non-trader", "content", performance.now() - t);
      } else {
        await expect(page.locator("#create-post-form")).toBeVisible({
          timeout: 20_000,
        });
        record("create-form-trader", "content", performance.now() - t);
      }
    } finally {
      await page.close();
    }
  }
});

test("Create invalid publish shows field errors (local vs round trip)", async ({
  browser,
}) => {
  const page = await browser.newPage({ viewport: { height: 800, width: 390 } });
  try {
    await signIn(page, "alice-test@perx.test");
    await page.goto(
      `${BASE}/app/opportunities/new?type=SERVICE&category=services`,
    );
    await expect(page.locator("#create-post-form")).toBeVisible({
      timeout: 20_000,
    });

    await page.getByLabel("Post title").fill("Perf probe invalid submission");
    await page
      .getByLabel("Short summary")
      .fill("A valid summary that is long enough for server validation.");
    await page
      .getByLabel("Details")
      .fill(
        "A complete opportunity description with enough scope, outcomes, timing, and expectations to pass the server validation contract.",
      );
    // Budget lives in the optional section, which is collapsed below `sm`.
    const budget = page.getByLabel("Budget minimum (NGN)");
    if (!(await budget.isVisible())) {
      await page
        .getByRole("button", { name: "Budget, location and participation" })
        .click();
    }
    await budget.fill("not-a-number");

    // Count server round trips triggered by the invalid submit.
    let posts = 0;
    let responseBytes = 0;
    page.on("request", (r) => {
      if (r.method() === "POST") posts += 1;
    });
    page.on("response", async (r) => {
      if (r.request().method() === "POST") {
        responseBytes += (await r.body().catch(() => Buffer.alloc(0))).length;
      }
    });

    const t = performance.now();
    await page.getByRole("button", { name: "Save draft" }).click();
    const summary = page.locator('#create-post-form [role="alert"]');
    await expect(summary).toContainText("Budget minimum", { timeout: 20_000 });
    record("create-invalid-validation", "content", performance.now() - t);
    record("create-invalid-validation", "server_posts", posts);
    record("create-invalid-validation", "post_response_bytes", responseBytes);
  } finally {
    await page.close();
  }
});

test("relationship action optimistic ack vs server persistence", async ({
  browser,
}) => {
  const { Pool } = await import("pg");
  const pool = new Pool({ connectionString: TEST_DB, ssl: false });
  const page = await browser.newPage({ viewport: { height: 800, width: 390 } });
  try {
    const ids = await pool.query<{ id: string; email: string }>(
      `SELECT id, email FROM "User" WHERE email IN ('carol-test@perx.test','bob-test@perx.test')`,
    );
    const carol = ids.rows.find((r) => r.email.startsWith("carol"))!.id;
    const bob = ids.rows.find((r) => r.email.startsWith("bob"))!.id;
    await pool.query(
      `DELETE FROM "Connection"
        WHERE ("requesterId"=$1 AND "receiverId"=$2)
           OR ("requesterId"=$2 AND "receiverId"=$1)`,
      [carol, bob],
    );

    await signIn(page, "carol-test@perx.test");
    await page.goto(`${BASE}/u/bob_test`);
    const root = page.locator("[data-relationship-state]").first();
    await expect(root).toHaveAttribute("data-relationship-state", "UNKNOWN");

    const settled = page.waitForResponse(
      (r) =>
        r.request().method() === "POST" &&
        new URL(r.url()).pathname.startsWith("/u/") &&
        r.status() < 400,
    );
    const t = performance.now();
    await root.getByRole("button", { name: "Connect" }).click();
    // Optimistic acknowledgement: state flips before the round trip returns.
    await expect(root).toHaveAttribute("data-relationship-state", "OUTGOING", {
      timeout: 10_000,
    });
    record("relationship-connect", "ack", performance.now() - t);
    await settled;
    record("relationship-connect", "settled", performance.now() - t);

    // Restore fixture state.
    await pool.query(
      `DELETE FROM "Connection"
        WHERE ("requesterId"=$1 AND "receiverId"=$2)
           OR ("requesterId"=$2 AND "receiverId"=$1)`,
      [carol, bob],
    );
  } finally {
    await page.close();
    await pool.end();
  }
});
