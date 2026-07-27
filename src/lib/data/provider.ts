import { getResolvedDataMode, isProductionRuntime } from "@/lib/env";
import { PerXDataProvider } from "./providers/interfaces";

let prismaProviderInstance: PerXDataProvider | null = null;
let mockProviderInstance: PerXDataProvider | null = null;

async function getNonProductionMockProvider() {
  if (isProductionRuntime()) {
    throw new Error("Mock data providers are prohibited in production.");
  }

  if (!mockProviderInstance) {
    const { mockProvider } = await import("./providers/mock-provider");
    mockProviderInstance = mockProvider;
  }

  return mockProviderInstance;
}

export async function getPerXDataProvider(context?: { mode?: "preview" | "mock" | "database" | "auto" }): Promise<PerXDataProvider> {
  if (context?.mode === "preview") {
    return getNonProductionMockProvider();
  }

  const mode = context?.mode ?? getResolvedDataMode();
  
  if (mode === "mock") {
    return getNonProductionMockProvider();
  }

  // In 'database' or 'auto' (which resolves to 'database' if available), dynamically import Prisma provider
  // This ensures Prisma is NEVER imported in the mock-mode import graph.
  if (!prismaProviderInstance) {
    const { prismaProvider } = await import("./providers/prisma-provider");
    prismaProviderInstance = prismaProvider;
  }
  
  return prismaProviderInstance;
}
