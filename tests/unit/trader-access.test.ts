import { describe, expect, it } from "vitest";

import {
  canAccessFeature,
  getFeatureById,
} from "@/lib/navigation/feature-registry";
import { hasCapability, type RoleName } from "@/lib/permissions/capabilities";
import { isTrader, TRADER_GRANT_ROLE } from "@/lib/trader/access";

describe("trader access", () => {
  it("derives trading access from the capability the route enforces", () => {
    // One source of truth. A separate "is a trader" flag is exactly how the
    // nav entry and the route gate drifted apart before.
    expect(isTrader(["CLIENT"])).toBe(true);
    expect(isTrader(["MEMBER"])).toBe(false);
    expect(isTrader(["FREELANCER"])).toBe(false);
  });

  it("grants a role that actually carries creation capability", () => {
    expect(hasCapability([TRADER_GRANT_ROLE], "opportunity:create")).toBe(true);
  });

  it("keeps Create discoverable for every authenticated user", () => {
    const create = getFeatureById("create-post");

    // Discoverability is not authorization: the destination decides. Hiding the
    // entry point made the product look like it had no Create at all.
    expect(canAccessFeature(create, ["MEMBER"])).toBe(true);
    expect(canAccessFeature(create, ["FREELANCER"])).toBe(true);
    expect(canAccessFeature(create, ["CLIENT"])).toBe(true);
  });

  it("still withholds the creation capability from a default member", () => {
    // The gate must remain real: Create being visible must not imply access.
    expect(hasCapability(["MEMBER"], "opportunity:create")).toBe(false);
  });
});

describe("self-assignable roles", () => {
  /*
    `/app/roles` let any authenticated user tick a box and immediately hold
    `opportunity:create`, which made the Create authorization gate decorative.
    Creation access now comes from a reviewed application instead.
  */
  const SELF_ASSIGNABLE: RoleName[] = ["FREELANCER", "INVESTOR"];

  it("no self-assignable role can grant creation access", () => {
    for (const role of SELF_ASSIGNABLE) {
      expect(
        hasCapability([role], "opportunity:create"),
        `${role} must not be self-assignable into creation access`,
      ).toBe(false);
    }
  });

  it("the reviewer-granted role is not self-assignable", () => {
    expect(SELF_ASSIGNABLE).not.toContain(TRADER_GRANT_ROLE);
  });
});
