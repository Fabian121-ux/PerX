import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

import { assertDatabaseConfiguration, getResolvedDataMode } from "@/lib/env";

declare global {
  var __perxPrisma: PrismaClient | undefined;
}

export function getPrisma() {
  const mode = getResolvedDataMode();
  if (mode === "mock") {
    throw new Error("Prisma cannot be initialized or used when PERX_DATA_MODE is 'mock'.");
  }

  assertDatabaseConfiguration();

  if (!globalThis.__perxPrisma) {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
    const adapter = new PrismaPg(pool);
    
    globalThis.__perxPrisma = new PrismaClient({
      adapter,
      log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    });
  }

  return globalThis.__perxPrisma;
}
