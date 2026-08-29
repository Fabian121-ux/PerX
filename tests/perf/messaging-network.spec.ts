import { test, type Page } from "@playwright/test";
import crypto from "node:crypto";

/**
 * Observes the real client request pattern on an open conversation.
 *
 * Purpose: prove whether the Batch 4 improvement still holds, i.e. that PerX
 * does NOT refetch a full conversation snapshot every 2 seconds. Records every
 * request the page issues over a fixed observation window, with payload sizes.
 *
 * Realtime availability is reported explicitly so fallback numbers are never
 * presented as healthy-Realtime numbers.
 */

const BASE = process.env.PERF_BASE_URL ?? "http://127.0.0.1:3200";
const TEST_DB = process.env.TEST_DATABASE_URL!;
const SESSION_COOKIE = process.env.SESSION_COOKIE_NAME ?? "perx_session";
const CONVERSATION = "cb58b9e9e460dcbf7b5450cba";
const OBSERVE_MS = 60_000;

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

test(`request pattern on an open conversation over ${OBSERVE_MS}ms`, async ({
  browser,
}) => {
  test.setTimeout(OBSERVE_MS + 90_000);
  const page = await browser.newPage({
    viewport: { height: 800, width: 1280 },
  });
  const seen: { url: string; bytes: number; at: number }[] = [];
  try {
    await signIn(page, "alice-test@perx.test");
    await page.goto(`${BASE}/app/messages/${CONVERSATION}`);
    await page.getByLabel("Message history").waitFor({ timeout: 30_000 });

    const start = Date.now();
    page.on("response", async (r) => {
      const u = new URL(r.url());
      if (
        !u.pathname.startsWith("/api/") &&
        u.pathname !== `/app/messages/${CONVERSATION}`
      )
        return;
      const body = await r.body().catch(() => Buffer.alloc(0));
      seen.push({
        at: Date.now() - start,
        bytes: body.length,
        url: u.pathname + (u.search ? "?…" : ""),
      });
    });

    await page.waitForTimeout(OBSERVE_MS);

    const liveState = await page
      .getByText(/^(Live|Reconnecting|Offline|Connecting)$/)
      .first()
      .textContent()
      .catch(() => null);

    const byPath = new Map<string, { n: number; bytes: number }>();
    for (const s of seen) {
      const e = byPath.get(s.url) ?? { bytes: 0, n: 0 };
      e.n += 1;
      e.bytes += s.bytes;
      byPath.set(s.url, e);
    }

    console.log("\n=== MESSAGING NETWORK OBSERVATION ===");
    console.log(`realtime_indicator=${liveState ?? "unknown"}`);
    console.log(`window_ms=${OBSERVE_MS}`);
    console.log("path,requests,total_bytes,avg_bytes,req_per_min");
    for (const [path, e] of [...byPath.entries()].sort(
      (a, b) => b[1].n - a[1].n,
    )) {
      const perMin = (e.n / (OBSERVE_MS / 60000)).toFixed(1);
      console.log(
        `${path},${e.n},${e.bytes},${Math.round(e.bytes / e.n)},${perMin}`,
      );
    }
    console.log("=== END MESSAGING NETWORK OBSERVATION ===\n");
  } finally {
    await page.close();
  }
});
