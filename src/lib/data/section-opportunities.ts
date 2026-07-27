import { getPrisma } from "@/lib/db/prisma";
import type { OpportunityType } from "@/generated/prisma/enums";

export async function getPublishedSectionOpportunities({
  category,
  take = 50,
  type,
}: {
  category?: string;
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
    take,
    where: {
      moderationStatus: "APPROVED",
      status: "PUBLISHED",
      ...(type ? { type } : {}),
      ...(category ? { category: { slug: category } } : {}),
    },
  });
}
