#!/usr/bin/env node
/**
 * Home feed query benchmark.
 *
 * Builds a disposable `perx_feedbench` database on the SAME server as
 * `TEST_DATABASE_URL`, seeds realistic volume, and compares the feed's keyset
 * query with and without the Batch 2 index.
 *
 * A separate database is used so `perx_test` keeps its small deterministic
 * fixture set - Playwright asserts against those exact rows.
 *
 * Refuses to run against anything but loopback.
 *
 *   node scripts/feed-query-benchmark.mjs
 *   node scripts/feed-query-benchmark.mjs --keep   (leave the database behind)
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import pg from "pg";

const LOOPBACK = new Set(["127.0.0.1", "::1", "[::1]", "localhost"]);
const BENCH_DB = "perx_feedbench";
const POSTS = 50_000;
const USERS = 5_000;
const PAGE = 12;

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
  console.error(
    `Safety Guard: benchmark refuses non-loopback host "${parsed.hostname}".`,
  );
  process.exit(1);
}

console.log(
  `target server: host=${parsed.hostname} port=${parsed.port || "5432"}`,
);

const adminUrl = new URL(testUrl);
adminUrl.pathname = "/postgres";
const benchUrl = new URL(testUrl);
benchUrl.pathname = `/${BENCH_DB}`;

const keep = process.argv.includes("--keep");

async function withClient(url, fn) {
  const client = new pg.Client({ connectionString: url.toString() });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

/** Median of the reported `Execution Time`, to damp cold-cache noise. */
async function timeQuery(client, sql, runs = 5) {
  const times = [];
  let plan = "";
  for (let i = 0; i < runs; i += 1) {
    const result = await client.query(`EXPLAIN (ANALYZE, BUFFERS) ${sql}`);
    const text = result.rows.map((r) => r["QUERY PLAN"]).join("\n");
    if (!plan) plan = text;
    const match = text.match(/Execution Time: ([\d.]+) ms/);
    if (match) times.push(Number(match[1]));
  }
  times.sort((a, b) => a - b);
  return { median: times[Math.floor(times.length / 2)], plan, times };
}

function summarise(plan) {
  const scan =
    plan.match(/Index (?:Only )?Scan(?: Backward)? using "?([\w_]+)"?/)?.[1] ??
    (/Seq Scan on/.test(plan) ? "SEQ SCAN" : "unknown");
  const removed = plan.match(/Rows Removed by Filter: (\d+)/)?.[1] ?? "0";
  const buffers = plan.match(/Buffers: shared hit=(\d+)/)?.[1] ?? "?";
  return { buffers, removed, scan };
}

const FEED_SQL = (depthMinutes, cursorId) => `
SELECT o.id, o.title, o."publishedAt", u.name
FROM "Opportunity" o
JOIN "User" u ON u.id = o."ownerId"
JOIN "Profile" p ON p."userId" = u.id
WHERE o.status='PUBLISHED' AND o."moderationStatus"='APPROVED'
  AND o."publishedAt" IS NOT NULL AND o.type <> 'INVESTMENT'
  AND u."isActive" AND u."bannedAt" IS NULL AND u."deactivatedAt" IS NULL
  AND u."accountClassification"='PUBLIC_BETA_USER' AND p."isDiscoverable"
  AND NOT EXISTS (SELECT 1 FROM "BlockedUser" b WHERE b."blockerUserId"=u.id AND b."blockedUserId"='u42')
  AND NOT EXISTS (SELECT 1 FROM "BlockedUser" b WHERE b."blockedUserId"=u.id AND b."blockerUserId"='u42')
  AND (o."publishedAt" < (NOW() - interval '${depthMinutes} minutes')
       OR (o."publishedAt" = (NOW() - interval '${depthMinutes} minutes') AND o.id < '${cursorId}'))
ORDER BY o."publishedAt" DESC, o.id DESC
LIMIT ${PAGE + 1}`;

await withClient(adminUrl, async (admin) => {
  await admin.query(`DROP DATABASE IF EXISTS "${BENCH_DB}"`);
  await admin.query(`CREATE DATABASE "${BENCH_DB}"`);
});
console.log(`created ${BENCH_DB}`);

try {
  await withClient(benchUrl, async (c) => {
    console.log("seeding schema + data ...");
    await c.query(`
      CREATE TYPE "OpportunityType" AS ENUM ('JOB','FREELANCE_PROJECT','STARTUP','COFOUNDER','INVESTMENT','PROPERTY','SERVICE','PRODUCT','PARTNERSHIP');
      CREATE TYPE "OpportunityStatus" AS ENUM ('DRAFT','PUBLISHED','PAUSED','CLOSED','ARCHIVED');
      CREATE TYPE "ModerationStatus" AS ENUM ('PENDING','APPROVED','REJECTED','FLAGGED');
      CREATE TYPE "AccountClassification" AS ENUM ('PUBLIC_BETA_USER','INTERNAL_TESTER');
      CREATE TABLE "User" (id text PRIMARY KEY, name text NOT NULL, "isActive" boolean NOT NULL DEFAULT true,
        "bannedAt" timestamptz, "deactivatedAt" timestamptz, "suspendedAt" timestamptz, "suspendedUntil" timestamptz,
        "accountClassification" "AccountClassification" NOT NULL DEFAULT 'PUBLIC_BETA_USER');
      CREATE TABLE "Profile" (id text PRIMARY KEY, "userId" text UNIQUE NOT NULL REFERENCES "User"(id), "isDiscoverable" boolean NOT NULL DEFAULT true);
      CREATE TABLE "BlockedUser" (id text PRIMARY KEY, "blockerUserId" text NOT NULL, "blockedUserId" text NOT NULL);
      CREATE INDEX ON "BlockedUser"("blockerUserId"); CREATE INDEX ON "BlockedUser"("blockedUserId");
      CREATE TABLE "Connection" (id text PRIMARY KEY, "requesterId" text NOT NULL, "receiverId" text NOT NULL,
        status text NOT NULL, "updatedAt" timestamptz NOT NULL DEFAULT now());
      CREATE INDEX ON "Connection"("requesterId", status); CREATE INDEX ON "Connection"("receiverId", status);
      CREATE TABLE "Opportunity" (id text PRIMARY KEY, "ownerId" text NOT NULL REFERENCES "User"(id),
        type "OpportunityType" NOT NULL, status "OpportunityStatus" NOT NULL, "moderationStatus" "ModerationStatus" NOT NULL,
        title text NOT NULL, slug text UNIQUE NOT NULL, summary text NOT NULL, "publishedAt" timestamptz);
    `);

    await c.query(
      `INSERT INTO "User"(id,name) SELECT 'u'||g,'User '||g FROM generate_series(1,${USERS}) g`,
    );
    await c.query(
      `INSERT INTO "Profile"(id,"userId") SELECT 'p'||g,'u'||g FROM generate_series(1,${USERS}) g`,
    );
    await c.query(`
      INSERT INTO "Opportunity"(id,"ownerId",type,status,"moderationStatus",title,slug,summary,"publishedAt")
      SELECT 'o'||g,'u'||((g % ${USERS})+1),
        (ARRAY['JOB','FREELANCE_PROJECT','STARTUP','COFOUNDER','SERVICE','PRODUCT','PARTNERSHIP'])[1+(g%7)]::"OpportunityType",
        'PUBLISHED','APPROVED','Post '||g,'post-'||g,'Summary '||g, NOW() - (g||' minutes')::interval
      FROM generate_series(1,${POSTS}) g`);
    await c.query(`
      INSERT INTO "Connection"(id,"requesterId","receiverId",status)
      SELECT 'c'||g,'u'||((g%${USERS})+1),'u'||(((g*7)%${USERS})+1),'ACCEPTED'
      FROM generate_series(1,20000) g ON CONFLICT DO NOTHING`);

    // The pre-existing index, without the id tie-breaker.
    await c.query(
      `CREATE INDEX "Opportunity_status_moderationStatus_publishedAt_idx" ON "Opportunity"(status,"moderationStatus","publishedAt")`,
    );
    await c.query(`ANALYZE`);
    console.log(`seeded ${POSTS} posts / ${USERS} authors\n`);

    const depths = [
      { cursor: "o36", label: "page 3   (~36 posts in)", minutes: 36 },
      { cursor: "o480", label: "page 40  (~480 posts in)", minutes: 480 },
      { cursor: "o4800", label: "page 400 (~4800 posts in)", minutes: 4800 },
    ];

    const before = [];
    for (const d of depths) {
      const r = await timeQuery(c, FEED_SQL(d.minutes, d.cursor));
      before.push({ ...summarise(r.plan), label: d.label, ms: r.median });
    }

    await c.query(
      `CREATE INDEX "Opportunity_status_moderationStatus_publishedAt_id_idx" ON "Opportunity"(status,"moderationStatus","publishedAt" DESC, id DESC)`,
    );
    await c.query(`ANALYZE`);

    const after = [];
    for (const d of depths) {
      const r = await timeQuery(c, FEED_SQL(d.minutes, d.cursor));
      after.push({ ...summarise(r.plan), label: d.label, ms: r.median });
    }

    const size = await c.query(
      `SELECT pg_size_pretty(pg_relation_size('"Opportunity_status_moderationStatus_publishedAt_id_idx"')) idx,
              pg_size_pretty(pg_relation_size('"Opportunity"')) tbl`,
    );

    console.log("=".repeat(78));
    console.log("HOME FEED KEYSET QUERY - median of 5 runs");
    console.log("=".repeat(78));
    console.log(
      "depth".padEnd(26) +
        "before".padEnd(10) +
        "after".padEnd(10) +
        "gain".padEnd(9) +
        "rows filtered (before→after)",
    );
    console.log("-".repeat(78));
    before.forEach((b, i) => {
      const a = after[i];
      console.log(
        b.label.padEnd(26) +
          `${b.ms.toFixed(1)}ms`.padEnd(10) +
          `${a.ms.toFixed(1)}ms`.padEnd(10) +
          `${(b.ms / a.ms).toFixed(1)}x`.padEnd(9) +
          `${b.removed} → ${a.removed}`,
      );
    });
    console.log("-".repeat(78));
    console.log(`index scan before: ${before.at(-1).scan}`);
    console.log(`index scan after:  ${after.at(-1).scan}`);
    console.log(
      `index size: ${size.rows[0].idx}   table size: ${size.rows[0].tbl}`,
    );
    console.log("=".repeat(78));
  });
} finally {
  if (!keep) {
    await withClient(adminUrl, async (admin) => {
      await admin.query(`DROP DATABASE IF EXISTS "${BENCH_DB}"`);
    });
    console.log(`dropped ${BENCH_DB}`);
  }
}
