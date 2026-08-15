import { describe, expect, it } from "vitest";

import {
  getAdminAccountState,
  getAdminActiveRestrictions,
} from "@/lib/admin/operational-summaries";

const now = new Date("2026-08-13T12:00:00.000Z");

function state(overrides: Record<string, unknown> = {}) {
  return {
    bannedAt: null,
    deactivatedAt: null,
    isActive: true,
    suspendedAt: null,
    suspendedUntil: null,
    ...overrides,
  } as Parameters<typeof getAdminAccountState>[0];
}

describe("admin operational summaries", () => {
  it("applies account state precedence and ignores expired suspension", () => {
    expect(
      getAdminAccountState(
        state({
          bannedAt: now,
          deactivatedAt: now,
          isActive: false,
          suspendedAt: now,
        }),
        now,
      ),
    ).toBe("BANNED");
    expect(getAdminAccountState(state({ deactivatedAt: now }), now)).toBe(
      "DEACTIVATED",
    );
    expect(getAdminAccountState(state({ isActive: false }), now)).toBe(
      "INACTIVE",
    );
    expect(getAdminAccountState(state({ suspendedAt: now }), now)).toBe(
      "SUSPENDED",
    );
    expect(
      getAdminAccountState(
        state({
          suspendedAt: new Date("2026-08-10T12:00:00.000Z"),
          suspendedUntil: new Date("2026-08-12T12:00:00.000Z"),
        }),
        now,
      ),
    ).toBe("ACTIVE");
  });

  it("returns only currently active channel restrictions", () => {
    expect(
      getAdminActiveRestrictions(
        {
          connectionRequestsRestrictedUntil: new Date(
            "2026-08-14T12:00:00.000Z",
          ),
          messagingRestrictedUntil: new Date("2026-08-12T12:00:00.000Z"),
          publishingRestrictedUntil: null,
        },
        now,
      ),
    ).toEqual([
      {
        kind: "CONNECTION_REQUESTS",
        until: new Date("2026-08-14T12:00:00.000Z"),
      },
    ]);
  });
});
