import type { OpportunityType } from "@/generated/prisma/enums";
import { getPrisma } from "@/lib/db/prisma";
import type { FeatureDefinition } from "@/lib/navigation/feature-registry";
import { searchFeatures } from "@/lib/navigation/feature-registry";
import {
  getPeopleDirectory,
  type PeopleDirectoryEntry,
} from "@/lib/data/people";
import {
  buildPublicOpportunityWhere,
  clampPublicOpportunityPageSize,
  normalizePublicOpportunityCursor,
  publicOpportunityInclude,
} from "@/lib/data/public-opportunities";
import type { ParsedSearchFilters } from "@/lib/search";

const ALL_SECTION_LIMIT = 6;
const LISTING_PAGE_SIZE = 12;
const FEATURE_RESULT_LIMIT = 24;

type SearchListingPageParams = {
  cursor?: string;
  location?: string;
  maxPriceMinor?: bigint;
  minPriceMinor?: bigint;
  pageSize: number;
  q?: string;
  type: OpportunityType;
};

export async function getSearchListingPage({
  cursor: requestedCursor,
  pageSize: requestedPageSize,
  ...filters
}: SearchListingPageParams) {
  const cursor = normalizePublicOpportunityCursor(requestedCursor);
  const pageSize = clampPublicOpportunityPageSize(requestedPageSize);
  const hasPriceFilter =
    filters.minPriceMinor !== undefined || filters.maxPriceMinor !== undefined;
  const rows = await getPrisma().opportunity.findMany({
    cursor: cursor ? { id: cursor } : undefined,
    include: publicOpportunityInclude,
    orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
    skip: cursor ? 1 : 0,
    take: pageSize + 1,
    where: {
      ...buildPublicOpportunityWhere(filters),
      ...(hasPriceFilter ? { currency: "NGN" } : {}),
    },
  });
  const hasNextPage = rows.length > pageSize;
  const items = hasNextPage ? rows.slice(0, pageSize) : rows;

  return {
    cursor: cursor ?? null,
    items,
    nextCursor: hasNextPage ? (items.at(-1)?.id ?? null) : null,
    pageSize,
  };
}

type ListingPage = Awaited<ReturnType<typeof getSearchListingPage>>;

export type UnifiedSearchResults = {
  features: FeatureDefinition[] | null;
  people: {
    items: PeopleDirectoryEntry[];
    nextCursor: string | null;
  } | null;
  products: ListingPage | null;
  services: ListingPage | null;
};

function includesCategory(
  selected: ParsedSearchFilters["category"],
  category: Exclude<ParsedSearchFilters["category"], "all">,
) {
  return selected === "all" || selected === category;
}

export function getFeatureSearchResults(
  query: string | undefined,
  roles: readonly string[],
  limit = FEATURE_RESULT_LIMIT,
) {
  const safeLimit = Number.isFinite(limit)
    ? Math.max(1, Math.min(Math.trunc(limit), FEATURE_RESULT_LIMIT))
    : FEATURE_RESULT_LIMIT;

  return searchFeatures(query ?? "", { roles }).slice(0, safeLimit);
}

export async function getUnifiedSearchResults(
  viewer: { id: string; roles: readonly string[] },
  filters: ParsedSearchFilters,
): Promise<UnifiedSearchResults> {
  const all = filters.category === "all";
  const searchPeople = includesCategory(filters.category, "people");
  const searchProducts = includesCategory(filters.category, "products");
  const searchServices = includesCategory(filters.category, "services");
  const searchFeatureRegistry = includesCategory(filters.category, "features");
  const listingPageSize = all ? ALL_SECTION_LIMIT : LISTING_PAGE_SIZE;
  const listingFilters = {
    cursor: all ? undefined : filters.cursor,
    location: filters.location,
    maxPriceMinor: filters.maxPriceMinor,
    minPriceMinor: filters.minPriceMinor,
    pageSize: listingPageSize,
    q: filters.q,
  };

  const [peoplePage, products, services] = await Promise.all([
    searchPeople
      ? getPeopleDirectory(viewer.id, {
          cursor: all ? undefined : filters.cursor,
          location: filters.location,
          q: filters.q,
          role: filters.role,
          skill: filters.skill,
        })
      : null,
    searchProducts && !filters.priceError
      ? getSearchListingPage({
          ...listingFilters,
          type: "PRODUCT",
        })
      : null,
    searchServices && !filters.priceError
      ? getSearchListingPage({
          ...listingFilters,
          type: "SERVICE",
        })
      : null,
  ]);

  return {
    features: searchFeatureRegistry
      ? getFeatureSearchResults(
          filters.q,
          viewer.roles,
          all ? ALL_SECTION_LIMIT : FEATURE_RESULT_LIMIT,
        )
      : null,
    people: peoplePage
      ? {
          items: all
            ? peoplePage.people.slice(0, ALL_SECTION_LIMIT)
            : peoplePage.people,
          nextCursor: all ? null : peoplePage.nextCursor,
        }
      : null,
    products,
    services,
  };
}
