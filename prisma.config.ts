import "dotenv/config";
import { defineConfig } from "prisma/config";

const databaseUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "";

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
