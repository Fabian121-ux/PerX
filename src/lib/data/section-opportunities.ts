import { getPrisma } from "@/lib/db/prisma";
import type { OpportunityType } from "@/generated/prisma/enums";

function normalizeSearch(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, 100) : undefined;
}

function publishedSectionWhere({
  category,
  q,
  type,
}: {
  category?: string;
  q?: string;
  type?: OpportunityType;
}) {
  const search = normalizeSearch(q);
  return {
    moderationStatus: "APPROVED" as const,
    status: "PUBLISHED" as const,
    owner: {
      accountClassification: "PUBLIC_BETA_USER" as const,
      isActive: true,
      profile: { is: { isDiscoverable: true } },
    },
    ...(type ? { type } : {}),
    ...(category ? { category: { slug: category } } : {}),
    ...(search
      ? {
          OR: [
            { title: { contains: search, mode: "insensitive" as const } },
            { summary: { contains: search, mode: "insensitive" as const } },
            { description: { contains: search, mode: "insensitive" as const } },
            { skills: { has: search } },
          ],
        }
      : {}),
  };
}

export async function getPublishedSectionOpportunities({
  category,
  q,
  skip = 0,
  take = 50,
  type,
}: {
  category?: string;
  q?: string;
  skip?: number;
  take?: number;
  type?: OpportunityType;
}) {
  return getPrisma().opportunity.findMany({
    include: {
      category: true,
      images: {
        orderBy: [{ isCover: "desc" }, { createdAt: "asc" }],
        take: 4,
      },
      owner: {
        select: {
          id: true,
          emailVerifiedAt: true,
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
    },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    skip,
    take,
    where: publishedSectionWhere({ category, q, type }),
  });
}

export async function getPublishedSectionOpportunityPage({
  category,
  page = 1,
  pageSize = 24,
  q,
  type,
}: {
  category?: string;
  page?: number;
  pageSize?: number;
  q?: string;
  type?: OpportunityType;
}) {
  const safePageSize = Math.max(1, Math.min(pageSize, 50));
  const safePage = Math.max(1, page);
  const where = publishedSectionWhere({ category, q, type });
  const prisma = getPrisma();
  const [items, total] = await Promise.all([
    getPublishedSectionOpportunities({
      category,
      q,
      skip: (safePage - 1) * safePageSize,
      take: safePageSize,
      type,
    }),
    prisma.opportunity.count({ where }),
  ]);

  return {
    hasNextPage: safePage * safePageSize < total,
    hasPreviousPage: safePage > 1,
    items,
    page: safePage,
    pageSize: safePageSize,
    total,
  };
}
