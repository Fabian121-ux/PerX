import { defineConfig } from "prisma/config";

export default defineConfig({
  datasource: {
    url: process.env.DATABASE_URL ?? "postgresql://prex:prex_password@localhost:5432/prex?schema=public",
  },
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  schema: "prisma/schema.prisma",
});
