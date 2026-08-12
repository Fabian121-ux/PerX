import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  agreementGroups: vi.fn(),
  reviewGroups: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  getPrisma: () => ({
    dealParticipant: { groupBy: mocks.agreementGroups },
    review: { groupBy: mocks.reviewGroups },
  }),
}));

import { getTrustRecordEvidenceByUserIds } from "@/lib/trust/records";

describe("trust record evidence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.agreementGroups.mockResolvedValue([
      { _count: { _all: 2 }, userId: "user-1" },
    ]);
    mocks.reviewGroups.mockResolvedValue([
      {
        _avg: { rating: 4.5 },
        _count: { _all: 3 },
        subjectId: "user-1",
      },
    ]);
  });

  it("combines eligible agreement and public-review aggregates", async () => {
    const evidence = await getTrustRecordEvidenceByUserIds([
      "user-1",
      "user-1",
      "user-2",
    ]);

    expect(evidence.get("user-1")).toEqual({
      averageRating: 4.5,
      completedAgreements: 2,
      publicReviewCount: 3,
    });
    expect(evidence.get("user-2")).toEqual({
      averageRating: 0,
      completedAgreements: 0,
      publicReviewCount: 0,
    });
    expect(mocks.agreementGroups).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          deal: { status: { in: ["APPROVED", "RELEASED"] } },
          userId: { in: ["user-1", "user-2"] },
        }),
      }),
    );
  });
});
