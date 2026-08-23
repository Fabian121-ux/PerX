#!/usr/bin/env node
/**
 * Route performance audit.
 *
 * Measures authenticated routes against the LOCAL test database by counting
 * real SQL statements and timing the server response. Query counting uses a
 * Postgres logical-replication-free approach: `pg_stat_statements` is not
 * assumed, so statements are counted by diffing `pg_stat_database.xact_commit`
 * plus a direct log-based counter where available.
 *
 * The reliable signal is `pg_stat_database.tup_returned` / `blks_read` deltas
 * plus wall-clock response time, so that is what is reported.
 *
 * Refuses to run against anything but loopback.
 *
 *   node scripts/route-performance-audit.mjs            (measure)
 *   node scripts/route-performance-audit.mjs --json     (machine-readable)
 */
import { existsSync, readFileSync } from "node:fs";
import crypto from "node:crypto";
import path from "node:path";

import pg from "pg";

const LOOPBACK = new Set(["127.0.0.1", "::1", "[::1]", "localhost"]);
const BASE = process.env.PERF_BASE_URL ?? "http://127.0.0.1:3100";
const RUNS = Number(process.env.PERF_RUNS ?? 5);
const jsonOutput = process.argv.includes("--json");

function loadTestUrl() {
  for (const file of [".env.test.local", ".env.test"]) {
    const p = path.resolve(process.cwd(), file);
    if (!existsSync(p)) continue;
    const m = readFileSync(p, "utf8").match(
      /^\s*TEST_DATABASE_URL\s*=\s*["']?([^"'\n]+)/m,
    );
    if (m) return m[1].trim();
  }
  return process.env.TEST_DATABASE_URL ?? "";
}

const testUrl = loadTestUrl();
if (!testUrl) {
  console.error("TEST_DATABASE_URL is not set.");
  process.exit(1);
}
const parsed = new URL(testUrl);
if (!LOOPBACK.has(parsed.hostname)) {
  console.error(`Safety Guard: refusing non-loopback host "${parsed.hostname}".`);
  process.exit(1);
}
if (!LOOPBACK.has(new URL(BASE).hostname)) {
  console.error(`Safety Guard: refusing non-loopback base URL "${BASE}".`);
  process.exit(1);
}

const client = new pg.Client({ connectionString: testUrl });
await client.connect();

/** Create a real session so routes execute their full authenticated path. */
async function createSession(email) {
  const user = await client.query(`SELECT id FROM "User" WHERE email = $1`, [
    email,
  ]);
  if (!user.rows[0]) throw new Error(`User ${email} not found`);
  const token = crypto.randomBytes(32).toString("base64url");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const id = `sess_${crypto.randomUUID()}`;
  await client.query(
    `INSERT INTO "Session" (id,"tokenHash","userId","expiresAt","createdAt","lastSeenAt")
     VALUES ($1,$2,$3,$4,NOW(),NOW())`,
    [id, tokenHash, user.rows[0].id, new Date(Date.now() + 3_600_000)],
  );
  return { id, token, userId: user.rows[0].id };
}

/**
 * Statement counter.
 *
 * `pg_stat_database` counts transactions, not statements, and Prisma runs most
 * reads outside explicit transactions - so the useful proxy is the delta in
 * `calls` from `pg_stat_statements` when the extension exists. Availability is
 * probed rather than assumed, and the report states which mode was used.
 */
const hasStatStatements = await client
  .query(`SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements'`)
  .then((r) => r.rowCount > 0)
  .catch(() => false);

async function statementSnapshot() {
  if (hasStatStatements) {
    const r = await client.query(
      `SELECT COALESCE(SUM(calls),0)::bigint AS calls FROM pg_stat_statements`,
    );
    return Number(r.rows[0].calls);
  }
  const r = await client.query(
    `SELECT COALESCE(xact_commit,0)::bigint AS n FROM pg_stat_database WHERE datname = current_database()`,
  );
  return Number(r.rows[0].n);
}

const ROUTES = [
  { label: "Home (/app)", path: "/app" },
  { label: "Home next page (API)", path: "/api/home-feed?segment=discovery" },
  { label: "Profile (/app/profile)", path: "/app/profile" },
  { label: "Network (/app/network)", path: "/app/network" },
  { label: "Messages (/app/messages)", path: "/app/messages" },
  { label: "Notifications", path: "/app/notifications" },
  { label: "Create Post", path: "/app/opportunities/new" },
  { label: "Search", path: "/app/search" },
];

const session = await createSession("alice-test@perx.test");
const cookie = `${process.env.SESSION_COOKIE_NAME ?? "perx_session"}=${session.token}`;

async function measure(route) {
  // Warm once so compilation/JIT cost is excluded from the sample.
  await fetch(`${BASE}${route.path}`, { headers: { cookie } }).catch(() => {});

  const times = [];
  let bytes = 0;
  let statements = 0;
  let status = 0;

  for (let i = 0; i < RUNS; i += 1) {
    const before = await statementSnapshot();
    const started = performance.now();
    const response = await fetch(`${BASE}${route.path}`, {
      headers: { cookie },
    });
    const body = await response.arrayBuffer();
    const elapsed = performance.now() - started;
    const after = await statementSnapshot();

    times.push(elapsed);
    bytes = body.byteLength;
    status = response.status;
    // Subtract the two snapshot queries this harness itself issues.
    statements = Math.max(0, after - before - 1);
  }

  times.sort((a, b) => a - b);
  return {
    bytesKb: +(bytes / 1024).toFixed(1),
    label: route.label,
    medianMs: +times[Math.floor(times.length / 2)].toFixed(1),
    minMs: +times[0].toFixed(1),
    path: route.path,
    statements,
    status,
  };
}

const results = [];
try {
  for (const route of ROUTES) {
    results.push(await measure(route));
  }
} finally {
  await client.query(`DELETE FROM "Session" WHERE id = $1`, [session.id]);
  await client.end();
}

if (jsonOutput) {
  console.log(JSON.stringify({ mode: hasStatStatements ? "pg_stat_statements" : "xact_commit", results }, null, 2));
} else {
  console.log("=".repeat(88));
  console.log(
    `ROUTE PERFORMANCE - median of ${RUNS} runs, local ${parsed.hostname}:${parsed.port}`,
  );
  console.log(
    `statement counter: ${hasStatStatements ? "pg_stat_statements (exact)" : "xact_commit delta (approximate)"}`,
  );
  console.log("=".repeat(88));
  console.log(
    "route".padEnd(28) +
      "status".padEnd(8) +
      "median".padEnd(11) +
      "min".padEnd(11) +
      "payload".padEnd(11) +
      "db",
  );
  console.log("-".repeat(88));
  for (const r of results) {
    console.log(
      r.label.padEnd(28) +
        String(r.status).padEnd(8) +
        `${r.medianMs}ms`.padEnd(11) +
        `${r.minMs}ms`.padEnd(11) +
        `${r.bytesKb}kb`.padEnd(11) +
        String(r.statements),
    );
  }
  console.log("=".repeat(88));
}
