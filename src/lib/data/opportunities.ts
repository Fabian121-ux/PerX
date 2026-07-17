import { getPerXDataProvider } from "./provider";

function logPublicDataFailure(scope: string, error: unknown) {
  const safeError =
    error instanceof Error
      ? { message: error.message, name: error.name }
      : { message: "Unknown data provider failure" };
  console.error(`Failed to load ${scope}.`, safeError);
}

export async function getOpportunityFeed(filters?: { category?: string; q?: string; type?: string }) {
  const provider = await getPerXDataProvider();
  try {
    return await provider.opportunities.getOpportunityFeed(filters);
  } catch (error) {
    logPublicDataFailure("opportunity feed", error);
    return [];
  }
}

export async function getPublicDiscoveryData(filters?: { category?: string; q?: string; type?: string }) {
  const provider = await getPerXDataProvider();
  try {
    const [opportunities, categories] = await Promise.all([
      provider.opportunities.getOpportunityFeed(filters),
      provider.opportunities.getCategories(),
    ]);
    return { categories, opportunities, unavailable: false };
  } catch (error) {
    logPublicDataFailure("public discovery data", error);
    return { categories: [], opportunities: [], unavailable: true };
  }
}

export async function getOpportunityBySlug(slug: string) {
  const provider = await getPerXDataProvider();
  try {
    return await provider.opportunities.getOpportunityBySlug(slug);
  } catch (error) {
    logPublicDataFailure("opportunity detail", error);
    return null;
  }
}

export async function getCategories() {
  const provider = await getPerXDataProvider();
  try {
    return await provider.opportunities.getCategories();
  } catch (error) {
    logPublicDataFailure("opportunity categories", error);
    return [];
  }
}

export async function getMyOpportunities(userId: string) {
  const provider = await getPerXDataProvider();
  return provider.opportunities.getMyOpportunities(userId);
}
