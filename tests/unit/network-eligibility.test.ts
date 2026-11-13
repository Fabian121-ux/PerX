import { describe, expect, it } from "vitest";

import {
  getDiscoverableNetworkTargetWhere,
  getEligibleNetworkUserWhere,
  isDiscoverableNetworkTarget,
  isEligibleNetworkAccount,
  type NetworkAccountSnapshot,
} from "@/features/network/eligibility";

function account(
  overrides: Partial<NetworkAccountSnapshot> = {},
): NetworkAccountSnapshot {
  return {
    accountClassification: "PUBLIC_BETA_USER",
    emailVerifiedAt: new Date("2026-01-01T00:00:00.000Z"),
    bannedAt: null,
    deactivatedAt: null,
    id: "member-1",
    isActive: true,
    profile: {
      allowConnectionRequests: true,
      allowMessagesFromConnections: true,
      biography: "A complete profile biography with enough detail.",
      headline: "Product founder",
      isDiscoverable: true,
      profileCompleteness: 80,
    },
    suspendedAt: null,
    suspendedUntil: null,
    verificationStatus: "VERIFIED",
    ...overrides,
  };
}

describe("network account eligibility", () => {
  it("allows active public members only after email and account verification", () => {
    expect(isEligibleNetworkAccount(account())).toBe(true);
    expect(
      isEligibleNetworkAccount(account({ verificationStatus: "PENDING" })),
    ).toBe(false);
    expect(isEligibleNetworkAccount(account({ emailVerifiedAt: null }))).toBe(
      false,
    );
  });

  it("does not expose an unverified or undiscoverable member as a target", () => {
    expect(isDiscoverableNetworkTarget(account())).toBe(true);
    expect(
      isDiscoverableNetworkTarget(
        account({ verificationStatus: "PENDING" }),
      ),
    ).toBe(false);
    expect(
      isDiscoverableNetworkTarget(
        account({
          profile: {
            allowConnectionRequests: true,
            allowMessagesFromConnections: true,
            biography: "A complete profile biography with enough detail.",
            headline: "Product founder",
            isDiscoverable: false,
            profileCompleteness: 80,
          },
        }),
      ),
    ).toBe(false);
    expect(
      isDiscoverableNetworkTarget(
        account({
          profile: {
            allowConnectionRequests: true,
            allowMessagesFromConnections: true,
            biography: "Profile setup is in progress.",
            headline: "New PtahX member",
            isDiscoverable: true,
            profileCompleteness: 30,
          },
        }),
      ),
    ).toBe(true);
  });

  it("requires email and account verification in Prisma eligibility filters", () => {
    const where = getEligibleNetworkUserWhere();
    expect(where).toMatchObject({
      accountClassification: "PUBLIC_BETA_USER",
      emailVerifiedAt: { not: null },
      verificationStatus: "VERIFIED",
      isActive: true,
      bannedAt: null,
      deactivatedAt: null,
    });

    expect(getDiscoverableNetworkTargetWhere("viewer-1")).toMatchObject({
      emailVerifiedAt: { not: null },
      verificationStatus: "VERIFIED",
      id: { not: "viewer-1" },
      profile: { is: { isDiscoverable: true } },
    });
  });
});
