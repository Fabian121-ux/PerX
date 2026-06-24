import { getPrisma } from "@/lib/db/prisma";
import { hasDatabaseUrl } from "@/lib/env";
import { isLocalTestUser } from "@/lib/dev/test-auth";
import { getTestMyOpportunities } from "@/lib/data/test-data-adapter";
import { getCurrentUser } from "@/lib/auth/session";
import { demoCategories, demoOpportunities } from "@/lib/data/demo";

export async function getOpportunityFeed({
  category,
  q,
  type,
}: {
  category?: string;
  q?: string;
  type?: string;
} = {}) {
  if (!hasDatabaseUrl()) {
    return demoOpportunities.filter((opportunity) => {
      const matchesCategory = !category || opportunity.category.slug === category;
      const matchesType = !type || opportunity.type === type;
      const matchesQuery =
        !q ||
        `${opportunity.title} ${opportunity.summary} ${opportunity.skills.join(" ")}`
          .toLowerCase()
          .includes(q.toLowerCase());
      return matchesCategory && matchesType && matchesQuery;
    });
  }

  try {
    return await getPrisma().opportunity.findMany({
      include: {
        category: true,
        owner: { include: { profile: true } },
      },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      take: 20,
      where: {
        moderationStatus: "APPROVED",
        status: "PUBLISHED",
        ...(category ? { category: { slug: category } } : {}),
        ...(type === "JOB" || type === "FREELANCE_PROJECT" ? { type } : {}),
        ...(q
          ? {
              OR: [
                { title: { contains: q, mode: "insensitive" } },
                { summary: { contains: q, mode: "insensitive" } },
                { description: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
    });
  } catch {
    return demoOpportunities;
  }
}

export async function getOpportunityBySlug(slug: string) {
  if (!hasDatabaseUrl()) {
    return demoOpportunities.find((opportunity) => opportunity.slug === slug) ?? null;
  }

  try {
    return await getPrisma().opportunity.findFirst({
      include: {
        category: true,
        owner: { include: { profile: true, roles: { include: { role: true } } } },
      },
      where: {
        moderationStatus: "APPROVED",
        slug,
        status: "PUBLISHED",
      },
    });
  } catch {
    return demoOpportunities.find((opportunity) => opportunity.slug === slug) ?? null;
  }
}

export async function getCategories() {
  if (!hasDatabaseUrl()) return demoCategories;

  try {
    return await getPrisma().opportunityCategory.findMany({ orderBy: { name: "asc" } });
  } catch {
    return demoCategories;
  }
}

export async function getMyOpportunities(userId: string) {
  const user = await getCurrentUser();
  if (isLocalTestUser(user)) return getTestMyOpportunities() as never;

  if (!hasDatabaseUrl()) return [];

  return getPrisma().opportunity.findMany({
    include: { category: true },
    orderBy: { updatedAt: "desc" },
    where: { ownerId: userId },
  });
}
