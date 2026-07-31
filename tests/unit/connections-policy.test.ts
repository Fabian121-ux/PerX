import { describe, expect, it } from "vitest";

import type { DealStatus } from "@/generated/prisma/enums";
import {
  CONNECTION_COPY,
  derivePartnerUserIds,
  getConnectedLabel,
  isEligiblePartnerDealStatus,
} from "@/features/network/data";
import {
  getDiscoverableNetworkTargetWhere,
  isDiscoverableNetworkTarget,
  isEligibleNetworkAccount,
  type NetworkAccountSnapshot,
} from "@/features/network/eligibility";

function account(
  overrides: Partial<NetworkAccountSnapshot> = {},
): NetworkAccountSnapshot {
  return {
    accountClassification: "PUBLIC_BETA_USER",
    bannedAt: null,
    deactivatedAt: null,
    id: "target-user",
    isActive: true,
    profile: {
      allowConnectionRequests: true,
      allowMessagesFromConnections: true,
      isDiscoverable: true,
    },
    suspendedAt: null,
    suspendedUntil: null,
    ...overrides,
  };
}

describe("network account eligibility", () => {
  const now = new Date("2026-07-31T12:00:00.000Z");

  it("allows only active public accounts without current enforcement", () => {
    expect(isEligibleNetworkAccount(account(), now)).toBe(true);
    expect(
      isEligibleNetworkAccount(
        account({
          suspendedAt: new Date("2026-07-01T00:00:00.000Z"),
          suspendedUntil: new Date("2026-07-30T00:00:00.000Z"),
        }),
        now,
      ),
    ).toBe(true);

    expect(
      [
        account({ isActive: false }),
        account({ bannedAt: new Date("2026-07-01T00:00:00.000Z") }),
        account({ deactivatedAt: new Date("2026-07-01T00:00:00.000Z") }),
        account({ accountClassification: "INTERNAL_TEST_USER" }),
        account({ accountClassification: "INTERNAL_ADMIN" }),
        account({ accountClassification: "SYSTEM_ACCOUNT" }),
        account({ suspendedAt: new Date("2026-07-01T00:00:00.000Z") }),
        account({
          suspendedAt: new Date("2026-07-01T00:00:00.000Z"),
          suspendedUntil: new Date("2026-08-01T00:00:00.000Z"),
        }),
      ].every((candidate) => !isEligibleNetworkAccount(candidate, now)),
    ).toBe(true);
  });

  it("treats profile visibility as a separate discoverability guard", () => {
    expect(isDiscoverableNetworkTarget(account(), now)).toBe(true);
    expect(
      isDiscoverableNetworkTarget(
        account({
          profile: {
            allowConnectionRequests: true,
            allowMessagesFromConnections: true,
            isDiscoverable: false,
          },
        }),
        now,
      ),
    ).toBe(false);

    expect(getDiscoverableNetworkTargetWhere("viewer", now)).toMatchObject({
      accountClassification: "PUBLIC_BETA_USER",
      bannedAt: null,
      blocksMade: { none: { blockedUserId: "viewer" } },
      blocksReceived: { none: { blockerUserId: "viewer" } },
      deactivatedAt: null,
      id: { not: "viewer" },
      isActive: true,
      profile: { is: { isDiscoverable: true } },
    });
  });
});

describe("connection partner state", () => {
  it("excludes only draft and cancelled PerX deals", () => {
    const statuses: DealStatus[] = [
      "DRAFT",
      "AWAITING_FUNDING",
      "FUNDED",
      "IN_PROGRESS",
      "SUBMITTED",
      "UNDER_REVIEW",
      "APPROVED",
      "RELEASED",
      "CANCELLED",
      "REFUND_PENDING",
      "REFUNDED",
      "DISPUTED",
      "RESOLVED",
    ];

    expect(statuses.filter(isEligiblePartnerDealStatus)).toEqual(
      statuses.filter((status) => !["DRAFT", "CANCELLED"].includes(status)),
    );
  });

  it("marks only connected users returned by the eligible agreement batch", () => {
    const partnerIds = derivePartnerUserIds(
      ["connected-a", "connected-b"],
      [{ userId: "connected-b" }, { userId: "not-connected" }],
    );

    expect([...partnerIds]).toEqual(["connected-b"]);
    expect(getConnectedLabel(false)).toBe("Connected");
    expect(getConnectedLabel(partnerIds.has("connected-b"))).toBe(
      "Connected · Partner",
    );
  });
});

describe("connection terminology", () => {
  it("uses the required action and state wording without social-network terms", () => {
    expect(CONNECTION_COPY).toMatchObject({
      accept: "Accept Connection",
      block: "Block",
      connect: "Connect With",
      connected: "Connected",
      decline: "Decline",
      message: "Message",
      remove: "Remove",
      report: "Report",
      requestSent: "Request sent",
    });
    expect(Object.values(CONNECTION_COPY).join(" ")).not.toMatch(/friend/i);
  });
});
