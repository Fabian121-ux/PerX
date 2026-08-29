import { test, type Page } from "@playwright/test";
import crypto from "node:crypto";

/**
 * Measures degraded-mode (Realtime unavailable) polling cost.
 *
 * Runs against the fallback server, where Supabase Realtime credentials are
 * absent, so the workspace genuinely degrades rather than being forced.
 *
 * Reports requests, bytes and effective rate for three states:
 *   active  - a message was just sent
 *   idle    - visible but untouched
 *   hidden  - backgrounded tab
 */

const BASE = process.env.PERF_BASE_URL ?? "http://127.0.0.1:3200";
const TEST_DB = process.env.TEST_DATABASE_URL!;
const SESSION_COOKIE = process.env.SESSION_COOKIE_NAME ?? "perx_session";
const OBSERVE_MS = Number(process.env.PERF_FALLBACK_WINDOW_MS ?? 90_000);

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

async function conversationId() {
  const { Pool } = await import("pg");
  const pool = new Pool({ connectionString: TEST_DB, ssl: false });
  try {
    const r = await pool.query<{ id: string }>(
      `SELECT c.id
         FROM "Conversation" c
         JOIN "ConversationParticipant" p ON p."conversationId" = c.id
         JOIN "User" u ON u.id = p."userId"
        WHERE u.email = 'alice-test@perx.test'
     ORDER BY c."updatedAt" DESC
        LIMIT 1`,
    );
    return r.rows[0]!.id;
  } finally {
    await pool.end();
  }
}

for (const mode of ["idle", "hidden"] as const) {
  test(`fallback cost - ${mode} conversation`, async ({ browser }) => {
    test.setTimeout(OBSERVE_MS + 120_000);
    const page = await browser.newPage({
      viewport: { height: 800, width: 1280 },
    });
    try {
      const conv = await conversationId();
      await signIn(page, "alice-test@perx.test");
      await page.goto(`${BASE}/app/messages/${conv}`);
      await page.getByLabel("Message history").waitFor({ timeout: 30_000 });

      if (mode === "hidden") {
        // Emulate a backgrounded tab: the workspace should stop polling.
        await page.evaluate(() => {
          Object.defineProperty(document, "visibilityState", {
            configurable: true,
            get: () => "hidden",
          });
          document.dispatchEvent(new Event("visibilitychange"));
        });
      }

      let requests = 0;
      let bytes = 0;
      const at: number[] = [];
      const start = Date.now();
      page.on("response", async (r) => {
        if (new URL(r.url()).pathname !== "/api/messages/sync") return;
        requests += 1;
        at.push(Date.now() - start);
        bytes += (await r.body().catch(() => Buffer.alloc(0))).length;
      });

      await page.waitForTimeout(OBSERVE_MS);

      const minutes = OBSERVE_MS / 60_000;
      // Gaps matter more than the mean: the schedule is supposed to widen
      // during a sustained outage and reset when Realtime briefly recovers,
      // so an averaged rate alone hides whether backoff engaged at all.
      const gaps = at.slice(1).map((v, i) => v - at[i]!);
      console.log(
        `\n=== FALLBACK ${mode.toUpperCase()} ===\n` +
          `window_ms=${OBSERVE_MS}\n` +
          `requests=${requests} (${(requests / minutes).toFixed(1)}/min)\n` +
          `bytes=${bytes} (${Math.round(bytes / minutes)}/min)\n` +
          `gaps_ms=${JSON.stringify(gaps)}\n` +
          `max_gap_ms=${gaps.length ? Math.max(...gaps) : 0}\n` +
          `=== END ===\n`,
      );
    } finally {
      await page.close();
    }
  });
}
