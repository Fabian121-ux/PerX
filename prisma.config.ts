import "dotenv/config";
import { defineConfig } from "prisma/config";

import {
  assertSafePrismaDatabaseTarget,
  describeDatabaseTarget,
  isPrismaDatabaseCommand,
} from "./src/lib/db/target-guard";

/**
 * Prisma CLI configuration.
 *
 * SAFETY: `import "dotenv/config"` above loads `.env`, which holds remote
 * credentials, and Prisma resolves its datasource as
 * `DIRECT_URL ?? DATABASE_URL`. Overriding only `DATABASE_URL` therefore does
 * NOT redirect the CLI - `DIRECT_URL` from `.env` still wins. That combination
 * previously allowed a `migrate deploy` meant for a local container to reach a
 * remote host.
 *
 * `assertSafePrismaDatabaseTarget` closes that hole: for any Prisma subcommand
 * that opens a connection, every database URL that is set must resolve to
 * loopback. It throws before Prisma performs any database operation.
 *
 * Schema-only commands (`generate`, `validate`, `format`) are unaffected, so
 * `postinstall` keeps working without a database.
 *
 * Application runtime is unaffected: this file is read by the Prisma CLI only,
 * and Production legitimately connects to a remote database at runtime.
 */
function migrationDatabaseUrl() {
  const value = process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "";
  if (!process.env.DIRECT_URL || !value) return value;

  try {
    const url = new URL(value);
    if (url.hostname.endsWith(".pooler.supabase.com") && url.port === "6543") {
      url.port = "5432";
      url.searchParams.delete("pgbouncer");
    }
    return url.toString();
  } catch {
    return value;
  }
}

// Fail closed before the datasource is handed to Prisma.
assertSafePrismaDatabaseTarget();

const databaseUrl = migrationDatabaseUrl();

if (!databaseUrl) {
  console.warn(
    "WARNING: DIRECT_URL or DATABASE_URL is not set. Prisma CLI commands may fail if they require a database connection.",
  );
} else if (isPrismaDatabaseCommand(process.argv)) {
  // Sanitized confirmation of the resolved target. Credentials are never
  // included, and it is printed only for commands that actually connect, so
  // there is no ambiguity about which database was touched.
  console.info(`Prisma database target: ${describeDatabaseTarget(databaseUrl)}`);
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: databaseUrl,
  },
});
