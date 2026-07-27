import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMocks = vi.hoisted(() => ({
  opportunityCount: vi.fn(),
  opportunityFindMany: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  getPrisma: () => ({
    opportunity: {
      count: prismaMocks.opportunityCount,
      findMany: prismaMocks.opportunityFindMany,
    },
  }),
}));

import { getPublishedSectionOpportunityPage } from "@/lib/data/section-opportunities";

describe("published content discovery query", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMocks.opportunityFindMany.mockResolvedValue([]);
    prismaMocks.opportunityCount.mockResolvedValue(0);
  });

  it("requires published, approved content from active discoverable public users", async () => {
    await getPublishedSectionOpportunityPage({
      category: "services",
      q: "design",
      type: "SERVICE",
    });

    expect(prismaMocks.opportunityFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 0,
        take: 24,
        where: expect.objectContaining({
          category: { slug: "services" },
          moderationStatus: "APPROVED",
          owner: {
            accountClassification: "PUBLIC_BETA_USER",
            isActive: true,
            profile: { is: { isDiscoverable: true } },
          },
          status: "PUBLISHED",
          type: "SERVICE",
        }),
      }),
    );
  });

  it("paginates without loading unbounded service rows", async () => {
    await getPublishedSectionOpportunityPage({
      page: 3,
      pageSize: 10,
      type: "SERVICE",
    });

    expect(prismaMocks.opportunityFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 20, take: 10 }),
    );
  });
});
