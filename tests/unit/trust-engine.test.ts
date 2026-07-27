import { describe, expect, it } from "vitest";

import { calculateTrustSummary } from "@/lib/trust/engine";

describe("trust engine", () => {
  it("does not fabricate a numeric score for a new account", () => {
    const trust = calculateTrustSummary();

    expect(trust.score).toBeNull();
    expect(trust.level).toBe("NEW");
    expect(trust.label).toBe("New member");
    expect(trust.evidenceCount).toBe(0);
  });

  it("uses stored evidence to move a member into a building state", () => {
    const trust = calculateTrustSummary({
      emailVerifiedAt: new Date("2026-07-01T00:00:00.000Z"),
      profileCompleteness: 85,
    });

    expect(trust.level).toBe("BUILDING");
    expect(trust.evidence).toContain("Profile completed");
    expect(trust.evidence).toContain("Email verified");
  });

  it("marks confirmed policy outcomes as under review without exposing hidden risk details", () => {
    const trust = calculateTrustSummary({
      confirmedPolicyViolations: 1,
      profileCompleteness: 90,
    });

    expect(trust.level).toBe("UNDER_REVIEW");
    expect(trust.description).not.toMatch(/threshold|fraud score|reporter/i);
  });
});
