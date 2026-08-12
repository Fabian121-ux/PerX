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
vi.mock("@/lib/trust/records", () => ({
  getTrustRecordEvidenceByUserIds: vi.fn(async (ids: string[]) =>
    new Map(
      ids.map((id) => [
        id,
        { averageRating: 0, completedAgreements: 0, publicReviewCount: 0 },
      ]),
    ),
  ),
}));

import { getPublishedSectionOpportunityPage } from "@/lib/data/section-opportunities";
import {
  buildPublicOpportunityWhere,
  getPublicOpportunityPage,
} from "@/lib/data/public-opportunities";

describe("published content discovery query", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMocks.opportunityFindMany.mockResolvedValue([]);
    prismaMocks.opportunityCount.mockResolvedValue(0);
  });

  it("builds the complete shared public-eligibility predicate", () => {
    const now = new Date("2026-07-31T12:00:00.000Z");
    const where = buildPublicOpportunityWhere(
      { excludeOwnerId: "viewer-1" },
      now,
    );

    expect(where).toEqual(
      expect.objectContaining({
        moderationStatus: "APPROVED",
        ownerId: { not: "viewer-1" },
        publishedAt: { not: null },
        status: "PUBLISHED",
        owner: expect.objectContaining({
          OR: [{ suspendedAt: null }, { suspendedUntil: { lte: now } }],
          accountClassification: "PUBLIC_BETA_USER",
          bannedAt: null,
          deactivatedAt: null,
          isActive: true,
          profile: { is: { isDiscoverable: true } },
        }),
      }),
    );
    expect(where.AND).toEqual(
      expect.arrayContaining([
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
      ]),
    );
  });

  it("excludes bilateral blocks for viewer-aware opportunity feeds", () => {
    const where = buildPublicOpportunityWhere({ viewerId: "viewer-1" });

    expect(where.owner).toEqual(
      expect.objectContaining({
        blocksMade: { none: { blockedUserId: "viewer-1" } },
        blocksReceived: { none: { blockerUserId: "viewer-1" } },
      }),
    );
  });

  it("constructs service filters without restricting the category", async () => {
    await getPublishedSectionOpportunityPage({
      location: "Lagos",
      maxPrice: "500.00",
      minPrice: "100.00",
      q: "design",
      type: "SERVICE",
    });

    const query = prismaMocks.opportunityFindMany.mock.calls[0]?.[0];
    expect(query).toEqual(
      expect.objectContaining({
        skip: 0,
        take: 25,
        where: expect.objectContaining({
          budgetMaxMinor: { lte: 50000n },
          budgetMinMinor: { gte: 10000n },
          location: { contains: "Lagos", mode: "insensitive" },
          type: "SERVICE",
        }),
      }),
    );
    expect(query.where).not.toHaveProperty("category");
    expect(query.where.AND).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          OR: expect.arrayContaining([
            { title: { contains: "design", mode: "insensitive" } },
          ]),
        }),
      ]),
    );
  });

  it("uses a bounded look-ahead cursor page and returns the next cursor", async () => {
    prismaMocks.opportunityFindMany.mockResolvedValueOnce([
      { id: "item-1", owner: { id: "owner-1" } },
      { id: "item-2", owner: { id: "owner-2" } },
      { id: "item-3", owner: { id: "owner-3" } },
    ]);

    const result = await getPublicOpportunityPage({
      cursor: "item-0",
      pageSize: 2,
    });

    expect(prismaMocks.opportunityFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        cursor: { id: "item-0" },
        skip: 1,
        take: 3,
      }),
    );
    expect(result.items).toHaveLength(2);
    expect(result.nextCursor).toBe("item-2");
  });

  it("clamps oversized page requests", async () => {
    await getPublicOpportunityPage({ pageSize: 10_000 });

    expect(prismaMocks.opportunityFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 25 }),
    );
  });
});
