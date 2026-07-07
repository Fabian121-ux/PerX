import { getResolvedDataMode } from "@/lib/env";
import { PerXDataProvider } from "./providers/interfaces";
import { mockProvider } from "./providers/mock-provider";

let prismaProviderInstance: PerXDataProvider | null = null;

export async function getPerXDataProvider(): Promise<PerXDataProvider> {
  const mode = getResolvedDataMode();
  
  if (mode === "mock") {
    return mockProvider;
  }

  // In 'database' or 'auto' (which resolves to 'database' if available), dynamically import Prisma provider
  // This ensures Prisma is NEVER imported in the mock-mode import graph.
  if (!prismaProviderInstance) {
    const { prismaProvider } = await import("./providers/prisma-provider");
    prismaProviderInstance = prismaProvider;
  }
  
  return prismaProviderInstance;
}
