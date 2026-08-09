import "dotenv/config";
import { defineConfig } from "prisma/config";

function migrationDatabaseUrl() {
  const value = process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "";
  if (!process.env.DIRECT_URL || !value) return value;

  try {
    const url = new URL(value);
    if (
      url.hostname.endsWith(".pooler.supabase.com") &&
      url.port === "6543"
    ) {
      url.port = "5432";
      url.searchParams.delete("pgbouncer");
    }
    return url.toString();
  } catch {
    return value;
  }
}

const databaseUrl = migrationDatabaseUrl();

if (!databaseUrl) {
  console.warn("WARNING: DIRECT_URL or DATABASE_URL is not set. Prisma CLI commands may fail if they require a database connection.");
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
