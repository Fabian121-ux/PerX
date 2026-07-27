import { describe, expect, it } from "vitest";

import {
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
});
