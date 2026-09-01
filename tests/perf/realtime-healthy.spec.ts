import { test, expect, type Page } from "@playwright/test";
import crypto from "node:crypto";

/**
 * Healthy-Realtime regression coverage.
 *
 * Requires a server whose Supabase Realtime credentials actually work, pointed
 * at the database Realtime replicates from. `PERF_REALTIME_BASE_URL` selects
 * it; the spec skips when that is absent so normal acceptance runs are
 * unaffected.
 *
 * The contract under test: when Realtime is healthy the client must NOT also
 * run the degraded polling loop. Realtime plus 5-second polling would silently
 * double the cost of the healthy path.
 */

const BASE = process.env.PERF_REALTIME_BASE_URL ?? "";
const DB = process.env.PERF_REALTIME_DATABASE_URL ?? "";
const SESSION_COOKIE = process.env.SESSION_COOKIE_NAME ?? "perx_session";
const OBSERVE_MS = 45_000;

const describeOrSkip = BASE && DB ? test.describe : test.describe.skip;

async function signIn(page: Page, email: string) {
  const { Pool } = await import("pg");
  const pool = new Pool({ connectionString: DB, ssl: false });
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

describeOrSkip("healthy Realtime", () => {
  test("does not run fallback polling while the stream is live", async ({
    browser,
  }) => {
    test.setTimeout(OBSERVE_MS + 90_000);
    const { Pool } = await import("pg");
    const pool = new Pool({ connectionString: DB, ssl: false });
    const page = await browser.newPage({
      viewport: { height: 800, width: 1280 },
    });
    try {
      const conv = await pool.query<{ id: string }>(
        `SELECT c.id
           FROM "Conversation" c
           JOIN "ConversationParticipant" p
             ON p."conversationId" = c.id
           JOIN "User" u ON u.id = p."userId"
          WHERE u.email = 'alice-test@perx.test'
          LIMIT 1`,
      );
      const conversationId = conv.rows[0]!.id;

      await signIn(page, "alice-test@perx.test");
      await page.goto(`${BASE}/app/messages/${conversationId}`);
      await page.getByLabel("Message history").waitFor({ timeout: 30_000 });

      // The workspace reports connection state; "Live" means the SSE stream
      // subscribed rather than degrading to polling.
      await expect(page.getByText("Live", { exact: true })).toBeVisible({
        timeout: 30_000,
      });

      const syncCalls: number[] = [];
      const probeCalls: number[] = [];
      const start = Date.now();
      page.on("response", (r) => {
        const path = new URL(r.url()).pathname;
        if (path === "/api/messages/sync") syncCalls.push(Date.now() - start);
        if (path === "/api/messages/check") probeCalls.push(Date.now() - start);
      });

      await page.waitForTimeout(OBSERVE_MS);

      const perMinute = syncCalls.length / (OBSERVE_MS / 60_000);
      console.log(
        `\n=== HEALTHY REALTIME POLLING ===\n` +
          `sync_requests=${syncCalls.length} (${perMinute.toFixed(1)}/min)\n` +
          `probe_requests=${probeCalls.length}\n` +
          `window_ms=${OBSERVE_MS}\n=== END ===\n`,
      );

      // Healthy mode must not run the degraded probe either.
      expect(
        probeCalls.length,
        `expected no fallback probes while Realtime is live, saw ${probeCalls.length}`,
      ).toBe(0);

      // Healthy Realtime is event driven. A steady 5s poll would be ~9 calls
      // in this window; anything at or above that means fallback is running
      // concurrently with a live stream.
      expect(
        syncCalls.length,
        `expected no fallback polling while Realtime is live, saw ${syncCalls.length} /api/messages/sync calls`,
      ).toBeLessThan(4);
    } finally {
      await page.close();
      await pool.end();
    }
  });
});
