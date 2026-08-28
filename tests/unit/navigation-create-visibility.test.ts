import { describe, expect, it } from "vitest";

import {
  authenticatedMobileNavigation,
  canAccessFeature,
  getFeatureById,
} from "@/lib/navigation/feature-registry";
import { hasCapability, type RoleName } from "@/lib/permissions/capabilities";

const createFeature = getFeatureById("create-post");

function mobileNavFor(roles: RoleName[]) {
  return authenticatedMobileNavigation
    .filter((item) => canAccessFeature(getFeatureById(item.featureId), roles))
    .map((item) => item.label);
}

const ALL_ROLES: RoleName[] = [
  "ADMIN",
  "CLIENT",
  "FOUNDER",
  "FREELANCER",
  "INTERNAL_TESTER",
  "INVESTOR",
  "MASTER_ADMIN",
  "MEMBER",
  "PROPERTY_OWNER",
];

describe("mobile Create navigation", () => {
  /*
    This previously asserted the opposite: Create was hidden from any role
    without `opportunity:create`. That made the product look like it had no
    Create at all for a default member, and hiding an entry point is not
    authorization.

    Create is now a discovery surface for every authenticated user, and the
    destination decides - traders reach the composer, everyone else reaches the
    Trader access gate. The gate itself is covered in `trader-access.spec.ts`.
  */
  it("is not gated in the registry", () => {
    expect(createFeature.requiredCapability).toBeUndefined();
    expect(createFeature.requiredRoles).toBeUndefined();
  });

  it.each(ALL_ROLES.map((role) => [role]))("shows Create to %s", (role) => {
    expect(mobileNavFor([role as RoleName])).toContain("Create");
  });

  it("keeps the bar at a stable five tabs for every role", () => {
    // A disappearing centre button reflowed the whole grid between accounts.
    for (const role of ALL_ROLES) {
      expect(mobileNavFor([role]).length, `${role} nav length`).toBe(
        authenticatedMobileNavigation.length,
      );
    }
  });

  it("does not imply the creation capability", () => {
    // Visibility and permission are deliberately decoupled. If this ever
    // becomes true for MEMBER it must be a reviewed product decision, not a
    // side effect of a navigation change.
    expect(hasCapability(["MEMBER"], "opportunity:create")).toBe(false);
    expect(hasCapability(["FREELANCER"], "opportunity:create")).toBe(false);
    expect(hasCapability(["INVESTOR"], "opportunity:create")).toBe(false);
  });

  it.each([["CLIENT"], ["FOUNDER"], ["PROPERTY_OWNER"]])(
    "still grants the creation capability to %s",
    (role) => {
      expect(hasCapability([role as RoleName], "opportunity:create")).toBe(
        true,
      );
    },
  );
});
