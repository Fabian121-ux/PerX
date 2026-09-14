#!/usr/bin/env node
/**
 * Generate the migration manifest consumed by the runtime drift check.
 *
 * The problem this solves: code auto-deploys to Vercel on merge, but
 * `prisma migrate deploy` is hand-run. In September a merged-but-unapplied
 * migration left Production running code its database had never seen, for 15
 * days. Nothing compared the two numbers, because nothing held both.
 *
 * This writes the repo's half of that comparison - the ordered list of
 * migrations the build EXPECTS - into a committed TypeScript module. The
 * database's half is read at runtime from `_prisma_migrations`.
 *
 * Why a generated module and not a filesystem read at runtime: `prisma/`
 * is not reliably present in a Vercel serverless bundle. Only what the module
 * graph imports is guaranteed to ship, so the list must be a real import.
 *
 * CI regenerates this and fails on any diff, so adding a migration without
 * regenerating cannot merge.
 *
 *   npm run migrations:manifest
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const MANIFEST_RELATIVE_PATH = "src/generated/migration-manifest.ts";
const MIGRATIONS_RELATIVE_PATH = "prisma/migrations";

/**
 * Read migration directory names, sorted lexicographically.
 *
 * Only directories count. `migration_lock.toml` sits alongside them and is not
 * a migration; neither is a stray `README.md` or `.DS_Store`. Prisma's own
 * ordering is lexicographic on the directory name, so sorting here matches the
 * order `migrate deploy` applies them in.
 */
export function readMigrationNames(migrationsDir) {
  return readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

/**
 * Render the manifest module.
 *
 * Kept deterministic and free of timestamps or machine detail: the output is
 * diffed by CI, so anything varying between runs would produce false failures.
 */
export function renderManifestModule(names) {
  const entries = names.map((name) => `  ${JSON.stringify(name)},`).join("\n");
  const body = names.length ? `[\n${entries}\n]` : "[]";

  return `/**
 * GENERATED FILE - DO NOT EDIT.
 *
 * Regenerate with \`npm run migrations:manifest\`. CI re-runs the generator and
 * fails if the result differs from this file, so edits here will be reverted
 * by the next regeneration.
 *
 * Source of truth: \`${MIGRATIONS_RELATIVE_PATH}/\`.
 *
 * This is the set of migrations this build expects its database to have
 * applied. \`src/lib/db/migration-drift.ts\` compares it against the rows in
 * \`_prisma_migrations\` at runtime, because the running application is the
 * only place that holds both numbers. CI cannot do this: it has no Production
 * credentials and must never be given any.
 */
export const MIGRATION_MANIFEST: readonly string[] = ${body};
`;
}

function main() {
  const root = process.cwd();
  const migrationsDir = path.join(root, MIGRATIONS_RELATIVE_PATH);
  const outputPath = path.join(root, MANIFEST_RELATIVE_PATH);

  let names;
  try {
    names = readMigrationNames(migrationsDir);
  } catch (error) {
    console.error(
      `Safety Guard: could not read ${MIGRATIONS_RELATIVE_PATH}.\n` +
        "Run this from the repository root.\n" +
        `  ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  }

  const next = renderManifestModule(names);

  let current = null;
  try {
    current = readFileSync(outputPath, "utf8");
  } catch {
    // First run: the file does not exist yet.
  }

  if (current === next) {
    console.log(
      `${MANIFEST_RELATIVE_PATH} already up to date (${names.length} migrations).`,
    );
    return;
  }

  writeFileSync(outputPath, next);
  console.log(
    `Wrote ${MANIFEST_RELATIVE_PATH} (${names.length} migrations, newest ${names.at(-1) ?? "(none)"}).`,
  );
}

// Only run when invoked directly, so the pure helpers above can be unit tested.
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  main();
}
