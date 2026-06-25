import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

import { hasDatabaseUrl } from "@/lib/env";

declare global {
  var __perxPrisma: PrismaClient | undefined;
}

export function getPrisma() {
  if (!hasDatabaseUrl()) {
    throw new Error("DATABASE_URL is not configured.");
  }

  if (!globalThis.__perxPrisma) {
    const adapter = new PrismaPg(process.env.DATABASE_URL!);
    globalThis.__perxPrisma = new PrismaClient({
      adapter,
      log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    });
  }

  return globalThis.__perxPrisma;
}
