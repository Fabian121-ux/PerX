import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  opportunityBookmarks: vi.fn(),
  profileBookmarks: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getCurrentUser: vi.fn(async () => ({ id: "viewer-1" })),
}));
vi.mock("@/lib/db/prisma", () => ({
  getPrisma: () => ({
    opportunityBookmark: { findMany: mocks.opportunityBookmarks },
    profileBookmark: { findMany: mocks.profileBookmarks },
  }),
}));
vi.mock("@/lib/trust/records", () => ({
  getTrustRecordEvidenceByUserIds: vi.fn(async () => new Map()),
}));

import SavedItemsPage from "@/app/app/saved/page";

describe("saved item visibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.opportunityBookmarks.mockResolvedValue([]);
    mocks.profileBookmarks.mockResolvedValue([]);
  });

  it("reapplies public eligibility and bilateral blocks to bookmarked records", async () => {
    await SavedItemsPage({ searchParams: Promise.resolve({}) });

    const opportunityWhere = mocks.opportunityBookmarks.mock.calls[0]?.[0].where;
    expect(opportunityWhere).toEqual(
      expect.objectContaining({
        opportunity: expect.objectContaining({
          moderationStatus: "APPROVED",
          publishedAt: { not: null },
          status: "PUBLISHED",
          owner: expect.objectContaining({
            blocksMade: { none: { blockedUserId: "viewer-1" } },
            blocksReceived: { none: { blockerUserId: "viewer-1" } },
            isActive: true,
          }),
        }),
        userId: "viewer-1",
      }),
    );

    const profileWhere = mocks.profileBookmarks.mock.calls[0]?.[0].where;
    expect(profileWhere).toEqual(
      expect.objectContaining({
        profile: {
          user: expect.objectContaining({
            blocksMade: { none: { blockedUserId: "viewer-1" } },
            blocksReceived: { none: { blockerUserId: "viewer-1" } },
            id: { not: "viewer-1" },
            isActive: true,
            profile: { is: { isDiscoverable: true } },
          }),
        },
        userId: "viewer-1",
      }),
    );
  });
});
