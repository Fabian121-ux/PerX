import { getPerXDataProvider } from "./provider";
import { isLocalTestUser } from "@/lib/dev/test-auth";
import { getTestMyOpportunities } from "@/lib/data/test-data-adapter";
import { getCurrentUser } from "@/lib/auth/session";

export async function getOpportunityFeed(filters?: { category?: string; q?: string; type?: string }) {
  const provider = await getPerXDataProvider();
  return provider.opportunities.getOpportunityFeed(filters);
}

export async function getOpportunityBySlug(slug: string) {
  const provider = await getPerXDataProvider();
  return provider.opportunities.getOpportunityBySlug(slug);
}

export async function getCategories() {
  const provider = await getPerXDataProvider();
  return provider.opportunities.getCategories();
}

export async function getMyOpportunities(userId: string) {
  const user = await getCurrentUser();
  if (isLocalTestUser(user)) return getTestMyOpportunities() as never;

  const provider = await getPerXDataProvider();
  return provider.opportunities.getMyOpportunities(userId);
}
