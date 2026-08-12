import { describe, expect, it } from "vitest";

import { calculateTrustSummary } from "@/lib/trust/engine";
import {
  createTrustPresentation,
  normalizeScore,
} from "@/lib/trust/presentation";

describe("B3 trust presentation contract", () => {
  it("publishes record-backed evidence without inventing a numeric score", () => {
    const summary = calculateTrustSummary({
      averageRating: 4.5,
      completedDeals: 2,
      emailVerifiedAt: "2026-08-10T12:00:00.000Z",
      profileCompleteness: 90,
    });
    const presentation = createTrustPresentation({
      averageRating: 4.5,
      completedAgreements: 2,
      emailVerified: true,
      profileCompleteness: 90,
      publicReviewCount: 3,
      summary,
    });

    expect(presentation.score).toEqual({
      kind: "not-published",
      reason: "methodology-not-approved",
    });
    expect(presentation.factors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "agreements", state: "met" }),
        expect.objectContaining({ key: "reviews", state: "met" }),
      ]),
    );
  });

  it("normalizes only an explicitly authoritative, versioned score", () => {
    const summary = calculateTrustSummary();
    const presentation = createTrustPresentation({
      authoritativeScore: {
        factors: [],
        lastUpdatedAt: "2026-08-10T12:00:00.000Z",
        maximum: 20,
        methodologyVersion: "future-approved-v1",
        source: "authoritative",
        value: 15,
      },
      summary,
    });

    expect(presentation.score).toEqual(
      expect.objectContaining({
        kind: "authoritative",
        methodologyVersion: "future-approved-v1",
        normalizedValue: 75,
      }),
    );
    expect(normalizeScore(200, 20)).toBe(100);
    expect(normalizeScore(1, 0)).toBe(0);
  });
});
