import { describe, expect, it } from "vitest";

import { calculateTrustScore, defaultTrustSignals } from "@/features/trust/trust-score";

describe("trust score", () => {
  it("returns an explainable weighted score", () => {
    const result = calculateTrustScore(
      defaultTrustSignals({
        averageRating: 4.5,
        completedDeals: 6,
        disputes: 0,
        moderationActions: 0,
        profileCompleteness: 90,
        successfulDeliveries: 7,
        verified: true,
      }),
    );

    expect(result.score).toBeGreaterThan(70);
    expect(result.breakdown.length).toBeGreaterThan(3);
  });
});
