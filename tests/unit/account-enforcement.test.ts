import { describe, expect, it } from "vitest";

import {
  evaluateAccountAccess,
  getOperationDecision,
  getRestrictionMessage,
  isTimedRestrictionActive,
} from "@/lib/account/enforcement";

describe("account enforcement helpers", () => {
  it("detects active timed restrictions only while the expiry is in the future", () => {
    const now = new Date("2026-07-27T12:00:00.000Z");

    expect(isTimedRestrictionActive(new Date("2026-07-27T13:00:00.000Z"), now)).toBe(true);
    expect(isTimedRestrictionActive(new Date("2026-07-27T11:59:00.000Z"), now)).toBe(false);
    expect(isTimedRestrictionActive(null, now)).toBe(false);
  });

  it("returns safe public enforcement messages without internal notes", () => {
    expect(
      getRestrictionMessage({
        bannedAt: null,
        connectionRequestsRestrictedUntil: null,
        deactivatedAt: null,
        enforcementReasonPublic: "Account access is temporarily restricted.",
        isActive: true,
        messagingRestrictedUntil: null,
        publishingRestrictedUntil: null,
        suspendedAt: new Date("2026-07-27T12:00:00.000Z"),
        suspendedUntil: new Date("2099-01-01T00:00:00.000Z"),
      }),
    ).toBe("Account access is temporarily restricted.");
  });

  it("denies authentication and application access during an active suspension", () => {
    const policy = evaluateAccountAccess({
      bannedAt: null,
      connectionRequestsRestrictedUntil: null,
      deactivatedAt: null,
      enforcementReasonPublic: "Internal moderation detail",
      isActive: true,
      messagingRestrictedUntil: null,
      publishingRestrictedUntil: null,
      suspendedAt: new Date("2026-07-27T12:00:00.000Z"),
      suspendedUntil: new Date("2026-07-27T13:00:00.000Z"),
    }, new Date("2026-07-27T12:30:00.000Z"));

    expect(policy.canAuthenticate).toBe(false);
    expect(policy.canAccessApplication).toBe(false);
    expect(policy.publicExplanation).toBe("This account is currently suspended.");
    expect(getOperationDecision(policy, "authenticate")).toBe(
      "This account is currently suspended.",
    );
    expect(policy.publicExplanation).not.toContain("Internal moderation");
  });

  it("allows an expired suspension and keeps feature restrictions independent", () => {
    const policy = evaluateAccountAccess(
      {
        bannedAt: null,
        connectionRequestsRestrictedUntil: null,
        deactivatedAt: null,
        enforcementReasonPublic: null,
        isActive: true,
        messagingRestrictedUntil: new Date("2026-07-27T14:00:00.000Z"),
        publishingRestrictedUntil: null,
        suspendedAt: new Date("2026-07-27T12:00:00.000Z"),
        suspendedUntil: new Date("2026-07-27T11:00:00.000Z"),
      },
      new Date("2026-07-27T12:30:00.000Z"),
    );

    expect(policy.canAuthenticate).toBe(true);
    expect(policy.canReadMessages).toBe(true);
    expect(policy.canSendMessages).toBe(false);
    expect(policy.canPublish).toBe(true);
  });

  it("requires verification for Deal creation without blocking ordinary reads", () => {
    const policy = evaluateAccountAccess({
      activeEnforcements: [
        {
          expiresAt: new Date("2026-07-27T14:00:00.000Z"),
          status: "ACTIVE",
          type: "VERIFICATION_REQUIRED",
        },
      ],
      bannedAt: null,
      connectionRequestsRestrictedUntil: null,
      deactivatedAt: null,
      enforcementReasonPublic: null,
      isActive: true,
      messagingRestrictedUntil: null,
      publishingRestrictedUntil: null,
      suspendedAt: null,
      suspendedUntil: null,
    }, new Date("2026-07-27T12:30:00.000Z"));

    expect(policy.canReadMessages).toBe(true);
    expect(policy.canCreateDeal).toBe(false);
    expect(policy.canPublish).toBe(false);
  });
});
