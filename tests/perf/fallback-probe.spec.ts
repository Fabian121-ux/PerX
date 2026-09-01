import { test, expect, type Page } from "@playwright/test";
import crypto from "node:crypto";

/**
 * Degraded-mode behaviour of the lightweight change probe.
 *
 * Runs against the fallback server (no working Realtime credentials), so the
 * workspace genuinely degrades rather than being forced into a fake state.
 *
 * The contract: while nothing changes, degraded ticks must use the cheap probe
 * and must NOT rebuild the full snapshot.
 */

const BASE = process.env.PERF_BASE_URL ?? "http://127.0.0.1:3200";
const TEST_DB = process.env.TEST_DATABASE_URL!;
const SESSION_COOKIE = process.env.SESSION_COOKIE_NAME ?? "perx_session";

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
    return user.rows[0].id;
  } finally {
    await pool.end();
  }
}

async function activeConversation(userId: string) {
  const { Pool } = await import("pg");
  const pool = new Pool({ connectionString: TEST_DB, ssl: false });
  try {
    const r = await pool.query<{ id: string }>(
      `SELECT c.id FROM "Conversation" c
         JOIN "ConversationParticipant" p ON p."conversationId" = c.id
        WHERE p."userId" = $1
     ORDER BY c."updatedAt" DESC LIMIT 1`,
      [userId],
    );
    return r.rows[0]!.id;
  } finally {
    await pool.end();
  }
}

function countRequests(page: Page) {
  const counts = { check: 0, checkBytes: 0, sync: 0, syncBytes: 0 };
  page.on("response", async (r) => {
    const path = new URL(r.url()).pathname;
    if (path === "/api/messages/check") {
      counts.check += 1;
      counts.checkBytes += (await r.body().catch(() => Buffer.alloc(0))).length;
    }
    if (path === "/api/messages/sync") {
      counts.sync += 1;
      counts.syncBytes += (await r.body().catch(() => Buffer.alloc(0))).length;
    }
  });
  return counts;
}

test("degraded unchanged ticks use the probe, not the full snapshot", async ({
  browser,
}) => {
  test.setTimeout(180_000);
  const page = await browser.newPage({
    viewport: { height: 800, width: 1280 },
  });
  try {
    const userId = await signIn(page, "alice-test@perx.test");
    const conversationId = await activeConversation(userId);
    await page.goto(`${BASE}/app/messages/${conversationId}`);
    await page.getByLabel("Message history").waitFor({ timeout: 30_000 });

    // Let the initial degraded reconciliation settle before counting.
    await page.waitForTimeout(12_000);
    const counts = countRequests(page);
    await page.waitForTimeout(60_000);

    console.log(
      `\n=== DEGRADED (no change) ===\n` +
        `probes=${counts.check} bytes=${counts.checkBytes}\n` +
        `full_syncs=${counts.sync} bytes=${counts.syncBytes}\n` +
        `=== END ===\n`,
    );

    expect(counts.check, "expected cheap probes to run").toBeGreaterThan(0);
    // The whole point: an unchanged conversation must not rebuild the snapshot
    // on every tick. Allow a small margin for a recovery reconciliation.
    expect(
      counts.sync,
      `expected few full syncs while nothing changed, saw ${counts.sync}`,
    ).toBeLessThanOrEqual(1);
    expect(counts.checkBytes).toBeLessThan(counts.syncBytes + 5_000);
  } finally {
    await page.close();
  }
});

test("a real change triggers exactly one reconciliation", async ({
  browser,
}) => {
  test.setTimeout(180_000);
  const { Pool } = await import("pg");
  const pool = new Pool({ connectionString: TEST_DB, ssl: false });
  const page = await browser.newPage({
    viewport: { height: 800, width: 1280 },
  });
  let insertedId: string | null = null;
  try {
    const userId = await signIn(page, "alice-test@perx.test");
    const conversationId = await activeConversation(userId);
    await page.goto(`${BASE}/app/messages/${conversationId}`);
    await page.getByLabel("Message history").waitFor({ timeout: 30_000 });
    await page.waitForTimeout(12_000);

    const counts = countRequests(page);
    // Quiet period first: proves the probe alone is not causing syncs.
    await page.waitForTimeout(20_000);
    const syncsBeforeChange = counts.sync;

    insertedId = `c${crypto.randomBytes(12).toString("hex")}`;
    const body = `probe change ${crypto.randomUUID()}`;
    await pool.query(
      `INSERT INTO "Message" (id,"conversationId","senderId",body,"createdAt")
       VALUES ($1,$2,$3,$4,NOW())`,
      [insertedId, conversationId, userId, body],
    );

    await page.waitForTimeout(45_000);

    console.log(
      `\n=== DEGRADED (change detected) ===\n` +
        `syncs_before_change=${syncsBeforeChange}\n` +
        `syncs_after_change=${counts.sync}\n` +
        `probes=${counts.check}\n` +
        `=== END ===\n`,
    );

    // The change must be picked up...
    expect(
      counts.sync,
      "expected a reconciliation after a real change",
    ).toBeGreaterThan(syncsBeforeChange);
    // ...but must not cause a reconciliation storm afterwards.
    expect(
      counts.sync - syncsBeforeChange,
      "expected reconciliation not to repeat every tick",
    ).toBeLessThanOrEqual(3);
  } finally {
    if (insertedId) {
      await pool
        .query(`DELETE FROM "Message" WHERE id = $1`, [insertedId])
        .catch(() => undefined);
    }
    await page.close();
    await pool.end();
  }
});

test("hidden tab performs no probe and no sync", async ({ browser }) => {
  test.setTimeout(150_000);
  const page = await browser.newPage({
    viewport: { height: 800, width: 1280 },
  });
  try {
    const userId = await signIn(page, "alice-test@perx.test");
    const conversationId = await activeConversation(userId);
    await page.goto(`${BASE}/app/messages/${conversationId}`);
    await page.getByLabel("Message history").waitFor({ timeout: 30_000 });

    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        get: () => "hidden",
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await page.waitForTimeout(8_000);

    const counts = countRequests(page);
    await page.waitForTimeout(60_000);

    console.log(
      `\n=== HIDDEN ===\nprobes=${counts.check} syncs=${counts.sync} ` +
        `bytes=${counts.checkBytes + counts.syncBytes}\n=== END ===\n`,
    );

    expect(counts.check, "hidden tab must not probe").toBe(0);
    expect(counts.sync, "hidden tab must not sync").toBe(0);
  } finally {
    await page.close();
  }
});
