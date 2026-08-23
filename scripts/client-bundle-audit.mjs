#!/usr/bin/env node
/**
 * Per-route client JavaScript audit.
 *
 * Measures what a browser actually downloads for a route by parsing the
 * server-rendered HTML for script tags and fetching each one, rather than
 * reading build output that varies by Next version.
 *
 * Requires a production server on the local port and the local test database.
 *
 *   npx next start -p 3100 -H 127.0.0.1
 *   node scripts/client-bundle-audit.mjs
 */
import { existsSync, readFileSync } from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import { gzipSync } from "node:zlib";

import pg from "pg";

const LOOPBACK = new Set(["127.0.0.1", "::1", "[::1]", "localhost"]);
const BASE = process.env.PERF_BASE_URL ?? "http://127.0.0.1:3100";

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
const parsed = new URL(testUrl);
if (!LOOPBACK.has(parsed.hostname) || !LOOPBACK.has(new URL(BASE).hostname)) {
  console.error("Safety Guard: loopback only.");
  process.exit(1);
}

const client = new pg.Client({ connectionString: testUrl });
await client.connect();

const user = await client.query(`SELECT id FROM "User" WHERE email = $1`, [
  "alice-test@perx.test",
]);
const token = crypto.randomBytes(32).toString("base64url");
const sessionId = `sess_${crypto.randomUUID()}`;
await client.query(
  `INSERT INTO "Session" (id,"tokenHash","userId","expiresAt","createdAt","lastSeenAt")
   VALUES ($1,$2,$3,$4,NOW(),NOW())`,
  [
    sessionId,
    crypto.createHash("sha256").update(token).digest("hex"),
    user.rows[0].id,
    new Date(Date.now() + 3_600_000),
  ],
);
const cookie = `${process.env.SESSION_COOKIE_NAME ?? "perx_session"}=${token}`;

const ROUTES = [
  ["Home", "/app"],
  ["Profile", "/app/profile"],
  ["Network", "/app/network"],
  ["Messages", "/app/messages"],
  ["Notifications", "/app/notifications"],
  ["Create Post", "/app/opportunities/new"],
];

// Cache across routes so shared chunks are fetched once but still attributed.
const sizeCache = new Map();

async function scriptSize(src) {
  if (sizeCache.has(src)) return sizeCache.get(src);
  const response = await fetch(`${BASE}${src}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  const entry = { gzip: gzipSync(buffer).length, raw: buffer.byteLength };
  sizeCache.set(src, entry);
  return entry;
}

const results = [];
try {
  for (const [label, route] of ROUTES) {
    const html = await (
      await fetch(`${BASE}${route}`, { headers: { cookie } })
    ).text();
    const scripts = [
      ...new Set(
        [...html.matchAll(/src="(\/_next\/static\/[^"]+\.js)"/g)].map(
          (match) => match[1],
        ),
      ),
    ];
    let raw = 0;
    let gzip = 0;
    for (const src of scripts) {
      const size = await scriptSize(src);
      raw += size.raw;
      gzip += size.gzip;
    }
    results.push({
      files: scripts.length,
      gzipKb: +(gzip / 1024).toFixed(1),
      label,
      rawKb: +(raw / 1024).toFixed(1),
    });
  }
} finally {
  await client.query(`DELETE FROM "Session" WHERE id = $1`, [sessionId]);
  await client.end();
}

console.log("=".repeat(62));
console.log("CLIENT JAVASCRIPT PER ROUTE (initial HTML script tags)");
console.log("=".repeat(62));
console.log(
  "route".padEnd(18) + "files".padEnd(9) + "raw".padEnd(13) + "gzip",
);
console.log("-".repeat(62));
for (const r of results) {
  console.log(
    r.label.padEnd(18) +
      String(r.files).padEnd(9) +
      `${r.rawKb} kB`.padEnd(13) +
      `${r.gzipKb} kB`,
  );
}
console.log("=".repeat(62));
