import { getPrisma } from "@/lib/db/prisma";
import type { OpportunityType } from "@/generated/prisma/enums";
import { isProductionMockModeError } from "@/lib/env";
import { logServerDataError } from "@/lib/logging/runtime";
import {
  buildPublicOpportunityWhere,
  clampPublicOpportunityPageSize,
  getPublicOpportunityPage,
  normalizePublicOpportunityCursor,
  parsePublicPriceFilter,
  publicOpportunityInclude,
  type PublicOpportunityFilters,
} from "@/lib/data/public-opportunities";

type PublishedSectionFilters = {
  category?: string;
  location?: string;
  maxPrice?: string;
  minPrice?: string;
  q?: string;
  type?: OpportunityType;
};

function getPublishedSectionFilters({
  category,
  location,
  maxPrice,
  minPrice,
  q,
  type,
}: PublishedSectionFilters): PublicOpportunityFilters {
  return {
    category,
    location,
    maxPriceMinor: parsePublicPriceFilter(maxPrice),
    minPriceMinor: parsePublicPriceFilter(minPrice),
    q,
    type,
  };
}

export async function getPublishedSectionOpportunities({
  category,
  location,
  maxPrice,
  minPrice,
  q,
  skip = 0,
  take = 50,
  type,
}: PublishedSectionFilters & {
  skip?: number;
  take?: number;
}) {
  const safeSkip = Number.isFinite(skip) ? Math.max(0, Math.trunc(skip)) : 0;
  const safeTake = Number.isFinite(take)
    ? Math.max(1, Math.min(Math.trunc(take), 50))
    : 50;

  return getPrisma().opportunity.findMany({
    include: publicOpportunityInclude,
    orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
    skip: safeSkip,
    take: safeTake,
    where: buildPublicOpportunityWhere(
      getPublishedSectionFilters({
        category,
        location,
        maxPrice,
        minPrice,
        q,
        type,
      }),
    ),
  });
}

export async function getPublishedSectionOpportunityPage({
  category,
  cursor,
  location,
  maxPrice,
  minPrice,
  pageSize = 24,
  q,
  type,
}: PublishedSectionFilters & {
  cursor?: string;
  pageSize?: number;
}) {
  const filters = getPublishedSectionFilters({
    category,
    location,
    maxPrice,
    minPrice,
    q,
    type,
  });
  const now = new Date();
  const where = buildPublicOpportunityWhere(filters, now);
  const prisma = getPrisma();
  const [page, total] = await Promise.all([
    getPublicOpportunityPage({
      ...filters,
      cursor,
      now,
      pageSize,
    }),
    prisma.opportunity.count({ where }),
  ]);

  return {
    ...page,
    total,
  };
}

export async function getPublishedSectionOpportunityPageResult(
  params: Parameters<typeof getPublishedSectionOpportunityPage>[0],
) {
  try {
    const page = await getPublishedSectionOpportunityPage(params);
    return { ...page, unavailable: false };
  } catch (error) {
    if (isProductionMockModeError(error)) throw error;

    logServerDataError({
      error,
      operation: "published section opportunity page",
      route: "authenticated discovery",
    });

    return {
      cursor: normalizePublicOpportunityCursor(params.cursor) ?? null,
      items: [],
      nextCursor: null,
      pageSize: clampPublicOpportunityPageSize(params.pageSize),
      total: 0,
      unavailable: true,
    };
  }
}
