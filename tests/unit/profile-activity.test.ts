import { beforeEach, describe, expect, it, vi } from "vitest";

const counts = {
  dealParticipant: vi.fn(),
  opportunity: vi.fn(),
  opportunityBookmark: vi.fn(),
  proposal: vi.fn(),
};

vi.mock("@/lib/db/prisma", () => ({
  getPrisma: () => ({
    dealParticipant: { count: counts.dealParticipant },
    opportunity: { count: counts.opportunity },
    opportunityBookmark: { count: counts.opportunityBookmark },
    proposal: { count: counts.proposal },
  }),
}));

const { getProfileActivity } = await import("@/lib/data/profile-activity");

describe("profile activity summary", () => {
  beforeEach(() => {
    for (const fn of Object.values(counts)) fn.mockReset();
  });

  it("scopes every aggregate to the viewer and reports the counts", async () => {
    counts.dealParticipant
      .mockResolvedValueOnce(2) // active
      .mockResolvedValueOnce(5); // completed
    counts.proposal
      .mockResolvedValueOnce(7) // sent
      .mockResolvedValueOnce(3); // received
    counts.opportunity
      .mockResolvedValueOnce(4) // drafts
      .mockResolvedValueOnce(9); // published
    counts.opportunityBookmark.mockResolvedValueOnce(11);

    const activity = await getProfileActivity("user-1");

    expect(activity).toEqual({
      activeAgreements: 2,
      completedAgreements: 5,
      degraded: false,
      drafts: 4,
      proposalsReceived: 3,
      proposalsSent: 7,
      published: 9,
      savedItems: 11,
    });

    // Private counts must never leak across users.
    for (const fn of Object.values(counts)) {
      for (const call of fn.mock.calls) {
        expect(JSON.stringify(call[0])).toContain("user-1");
      }
    }
  });

  it("separates drafts from published rather than counting all owned posts", async () => {
    counts.dealParticipant.mockResolvedValue(0);
    counts.proposal.mockResolvedValue(0);
    counts.opportunity.mockResolvedValue(0);
    counts.opportunityBookmark.mockResolvedValue(0);

    await getProfileActivity("user-1");

    const statuses = counts.opportunity.mock.calls.map(
      (call) => call[0].where.status,
    );
    expect(statuses).toEqual(["DRAFT", "PUBLISHED"]);
  });

  it("degrades individual counts instead of failing the whole profile", async () => {
    // Saved items fails; everything else succeeds. Profile must still render.
    counts.dealParticipant.mockResolvedValueOnce(1).mockResolvedValueOnce(2);
    counts.proposal.mockResolvedValueOnce(3).mockResolvedValueOnce(4);
    counts.opportunity.mockResolvedValueOnce(5).mockResolvedValueOnce(6);
    counts.opportunityBookmark.mockRejectedValueOnce(
      new Error("bookmark aggregate unavailable"),
    );

    const activity = await getProfileActivity("user-1");

    expect(activity.degraded).toBe(true);
    expect(activity.savedItems).toBe(0);
    // Successful aggregates are preserved.
    expect(activity.activeAgreements).toBe(1);
    expect(activity.published).toBe(6);
  });

  it("returns empty counts without querying when there is no viewer", async () => {
    const activity = await getProfileActivity("");

    expect(activity.degraded).toBe(false);
    expect(activity.savedItems).toBe(0);
    for (const fn of Object.values(counts)) {
      expect(fn).not.toHaveBeenCalled();
    }
  });
});
