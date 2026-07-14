import { getPerXDataProvider } from "./provider";

export async function getOpportunityFeed(filters?: { category?: string; q?: string; type?: string }) {
  const provider = await getPerXDataProvider();
  try {
    return await provider.opportunities.getOpportunityFeed(filters);
  } catch (error) {
    console.error("Failed to load opportunity feed:", error);
    return []; // Return empty feed instead of crashing the public page
  }
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
  const provider = await getPerXDataProvider();
  return provider.opportunities.getMyOpportunities(userId);
}
