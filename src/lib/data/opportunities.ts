import { getPerXDataProvider } from "./provider";
import { isProductionMockModeError } from "@/lib/env";
import { logServerDataError } from "@/lib/logging/runtime";

function logPublicDataFailure(scope: string, error: unknown) {
  if (isProductionMockModeError(error)) throw error;

  logServerDataError({
    error,
    operation: scope,
    route: "public",
  });
}

export async function getOpportunityFeedResult(filters?: { category?: string; q?: string; type?: string }) {
  try {
    const provider = await getPerXDataProvider();
    const opportunities = await provider.opportunities.getOpportunityFeed(filters);
    return { opportunities, unavailable: false };
  } catch (error) {
    logPublicDataFailure("opportunity feed", error);
    return { opportunities: [], unavailable: true };
  }
}

export async function getOpportunityFeed(filters?: { category?: string; q?: string; type?: string }) {
  const result = await getOpportunityFeedResult(filters);
  return result.opportunities;
}

export async function getPublicDiscoveryData(filters?: { category?: string; q?: string; type?: string }) {
  try {
    const provider = await getPerXDataProvider();
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

export async function getOpportunityBySlugResult(slug: string) {
  try {
    const provider = await getPerXDataProvider();
    const opportunity = await provider.opportunities.getOpportunityBySlug(slug);
    return { opportunity, unavailable: false };
  } catch (error) {
    logPublicDataFailure("opportunity detail", error);
    return { opportunity: null, unavailable: true };
  }
}

export async function getOpportunityBySlug(slug: string) {
  const result = await getOpportunityBySlugResult(slug);
  return result.opportunity;
}

export async function getCategoriesResult() {
  try {
    const provider = await getPerXDataProvider();
    const categories = await provider.opportunities.getCategories();
    return { categories, unavailable: false };
  } catch (error) {
    logPublicDataFailure("opportunity categories", error);
    return { categories: [], unavailable: true };
  }
}

export async function getCategories() {
  const result = await getCategoriesResult();
  return result.categories;
}

export async function getMyOpportunities(userId: string) {
  const provider = await getPerXDataProvider();
  return provider.opportunities.getMyOpportunities(userId);
}
