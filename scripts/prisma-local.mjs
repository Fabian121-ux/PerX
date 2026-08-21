#!/usr/bin/env node
/**
 * Run a Prisma CLI command against the local test database.
 *
 * The problem this solves: `prisma.config.ts` loads `.env` and resolves its
 * datasource as `DIRECT_URL ?? DATABASE_URL`. Exporting only `DATABASE_URL`
 * therefore leaves `DIRECT_URL` pointing at whatever `.env` contains, which is
 * how a local-looking `migrate deploy` reached remote infrastructure.
 *
 * This wrapper sets BOTH variables from `.env.test.local`'s `TEST_DATABASE_URL`
 * / `TEST_DIRECT_URL`, so there is no precedence ambiguity, and re-checks the
 * result through the same guard `prisma.config.ts` uses.
 *
 *   npm run db:local -- migrate deploy
 *   npm run db:local -- migrate status
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

import dotenv from "dotenv";

const rootDir = process.cwd();

// Only test env files. `.env` is never loaded here - it holds remote values,
// and loading it is precisely the behaviour this script exists to avoid.
for (const file of [".env.test.local", ".env.test"]) {
  const candidate = path.resolve(rootDir, file);
  if (existsSync(candidate)) dotenv.config({ path: candidate, quiet: true });
}

const databaseUrl = process.env.TEST_DATABASE_URL;
const directUrl = process.env.TEST_DIRECT_URL ?? databaseUrl;

if (!databaseUrl) {
  console.error(
    "Safety Guard: TEST_DATABASE_URL is not set.\n" +
      "Add it to .env.test.local, e.g.\n" +
      '  TEST_DATABASE_URL="postgresql://user:password@127.0.0.1:55434/perx_test?schema=public"',
  );
  process.exit(1);
}

/**
 * Local check, duplicated deliberately.
 *
 * `src/lib/db/target-guard.ts` is TypeScript and this is a plain `.mjs` script,
 * so importing it would require a loader. `prisma.config.ts` still applies the
 * full guard to whatever this sets, making that the authoritative gate; this is
 * a fast pre-check that produces a clearer message about which TEST_ variable
 * is wrong.
 */
const LOOPBACK = new Set(["127.0.0.1", "::1", "[::1]", "localhost"]);

function describe(url) {
  try {
    const parsed = new URL(url);
    const database = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
    return `host=${parsed.hostname} port=${parsed.port || "5432"} database=${database || "(none)"} schema=${parsed.searchParams.get("schema") ?? "(default)"}`;
  } catch {
    return "(unparseable database URL)";
  }
}

function isLocal(url) {
  try {
    return LOOPBACK.has(new URL(url).hostname);
  } catch {
    return false;
  }
}

for (const [name, url] of [
  ["TEST_DATABASE_URL", databaseUrl],
  ["TEST_DIRECT_URL", directUrl],
]) {
  if (!isLocal(url)) {
    console.error(`Safety Guard: ${name} is not local.\n  ${describe(url)}`);
    process.exit(1);
  }
}

console.info(`Prisma local target: ${describe(databaseUrl)}`);

const args = process.argv.slice(2);
if (!args.length) {
  console.error("Usage: npm run db:local -- <prisma args>");
  process.exit(1);
}

const result = spawnSync("npx", ["prisma", ...args], {
  env: {
    ...process.env,
    DATABASE_URL: databaseUrl,
    DIRECT_URL: directUrl,
  },
  stdio: "inherit",
});

process.exit(result.status ?? 1);
