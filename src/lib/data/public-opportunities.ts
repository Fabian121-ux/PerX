import type { Prisma } from "@/generated/prisma/client";
import type { OpportunityType } from "@/generated/prisma/enums";
import { getPrisma } from "@/lib/db/prisma";
import { parseMoneyToMinor } from "@/lib/money";
import { getTrustRecordEvidenceByUserIds } from "@/lib/trust/records";

export const DEFAULT_PUBLIC_OPPORTUNITY_PAGE_SIZE = 12;
export const MAX_PUBLIC_OPPORTUNITY_PAGE_SIZE = 24;
const MAX_DATABASE_BIGINT = 9_223_372_036_854_775_807n;

export type PublicOpportunityFilters = {
  category?: string;
  excludeOwnerId?: string;
  location?: string;
  maxPriceMinor?: bigint;
  minPriceMinor?: bigint;
  q?: string;
  type?: OpportunityType;
  viewerId?: string;
};

export type PublicOpportunityPageParams = PublicOpportunityFilters & {
  cursor?: string;
  now?: Date;
  pageSize?: number;
};

export const publicOpportunityInclude = {
  category: true,
  images: {
    orderBy: [{ isCover: "desc" }, { createdAt: "asc" }],
    take: 4,
  },
  owner: {
    select: {
      emailVerifiedAt: true,
      id: true,
      imageUrl: true,
      name: true,
      profile: {
        select: {
          averageRating: true,
          completedDeals: true,
          profileCompleteness: true,
          profileImageUrl: true,
        },
      },
      username: true,
      verificationStatus: true,
    },
  },
} satisfies Prisma.OpportunityInclude;

function normalizeFilter(value: string | undefined, maxLength: number) {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, maxLength) : undefined;
}

export function normalizePublicOpportunityCursor(cursor?: string) {
  const normalized = cursor?.trim();
  return normalized && normalized.length <= 128 ? normalized : undefined;
}

export function clampPublicOpportunityPageSize(pageSize?: number) {
  if (pageSize === undefined || !Number.isFinite(pageSize)) {
    return DEFAULT_PUBLIC_OPPORTUNITY_PAGE_SIZE;
  }

  return Math.max(
    1,
    Math.min(Math.trunc(pageSize), MAX_PUBLIC_OPPORTUNITY_PAGE_SIZE),
  );
}

export function parsePublicPriceFilter(value?: string) {
  const normalized = value?.trim();
  if (!normalized || normalized.length > 18) return undefined;

  try {
    const amountMinor = parseMoneyToMinor(normalized).amountMinor;
    return amountMinor <= MAX_DATABASE_BIGINT ? amountMinor : undefined;
  } catch {
    return undefined;
  }
}

export function buildPublicOpportunityWhere(
  filters: PublicOpportunityFilters = {},
  now = new Date(),
): Prisma.OpportunityWhereInput {
  const category = normalizeFilter(filters.category, 80);
  const location = normalizeFilter(filters.location, 100);
  const search = normalizeFilter(filters.q, 100);
  const minPriceMinor =
    filters.minPriceMinor !== undefined && filters.minPriceMinor >= 0n
      ? filters.minPriceMinor
      : undefined;
  const maxPriceMinor =
    filters.maxPriceMinor !== undefined && filters.maxPriceMinor >= 0n
      ? filters.maxPriceMinor
      : undefined;
  const and: Prisma.OpportunityWhereInput[] = [
    { type: { not: "INVESTMENT" } },
    {
      OR: [
        { propertyListingType: null },
        { propertyListingType: { not: "CO_INVESTMENT" } },
      ],
    },
    {
      OR: [
        { type: { not: "PROPERTY" } },
        { propertyVerificationState: "PUBLISHED", type: "PROPERTY" },
      ],
    },
  ];

  if (search) {
    and.push({
      OR: [
        { title: { contains: search, mode: "insensitive" } },
        { summary: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { skills: { has: search } },
      ],
    });
  }

  return {
    AND: and,
    moderationStatus: "APPROVED",
    publishedAt: { not: null },
    status: "PUBLISHED",
    owner: {
      OR: [{ suspendedAt: null }, { suspendedUntil: { lte: now } }],
      accountClassification: "PUBLIC_BETA_USER",
      bannedAt: null,
      deactivatedAt: null,
      isActive: true,
      profile: { is: { isDiscoverable: true } },
      ...(filters.viewerId
        ? {
            blocksMade: { none: { blockedUserId: filters.viewerId } },
            blocksReceived: { none: { blockerUserId: filters.viewerId } },
          }
        : {}),
    },
    ...(filters.excludeOwnerId
      ? { ownerId: { not: filters.excludeOwnerId } }
      : {}),
    ...(filters.type ? { type: filters.type } : {}),
    ...(category ? { category: { slug: category } } : {}),
    ...(location
      ? { location: { contains: location, mode: "insensitive" } }
      : {}),
    ...(minPriceMinor !== undefined
      ? { budgetMinMinor: { gte: minPriceMinor } }
      : {}),
    ...(maxPriceMinor !== undefined
      ? { budgetMaxMinor: { lte: maxPriceMinor } }
      : {}),
  };
}

export async function getPublicOpportunityPage({
  cursor: requestedCursor,
  now = new Date(),
  pageSize: requestedPageSize,
  ...filters
}: PublicOpportunityPageParams = {}) {
  const cursor = normalizePublicOpportunityCursor(requestedCursor);
  const pageSize = clampPublicOpportunityPageSize(requestedPageSize);
  const rows = await getPrisma().opportunity.findMany({
    cursor: cursor ? { id: cursor } : undefined,
    include: publicOpportunityInclude,
    orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
    skip: cursor ? 1 : 0,
    take: pageSize + 1,
    where: buildPublicOpportunityWhere(filters, now),
  });
  const hasNextPage = rows.length > pageSize;
  const items = hasNextPage ? rows.slice(0, pageSize) : rows;
  const trustEvidence = await getTrustRecordEvidenceByUserIds(
    items.map((item) => item.owner.id),
  );

  return {
    cursor: cursor ?? null,
    items: items.map((item) => ({
      ...item,
      owner: {
        ...item.owner,
        trustRecordEvidence: trustEvidence.get(item.owner.id),
      },
    })),
    nextCursor: hasNextPage ? (items.at(-1)?.id ?? null) : null,
    pageSize,
  };
}
