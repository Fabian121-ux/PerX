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

describe("mobile Create navigation gating", () => {
  it("derives visibility from the capability the destination enforces", () => {
    // Regression guard: the nav previously carried its own hard-coded role
    // list that drifted away from `opportunity:create`, so Create silently
    // vanished for roles that were otherwise entitled to it.
    expect(createFeature.requiredCapability).toBe("opportunity:create");
    expect(createFeature.requiredRoles).toBeUndefined();
  });

  it.each([
    ["CLIENT"],
    ["FOUNDER"],
    ["PROPERTY_OWNER"],
    ["ADMIN"],
    ["MASTER_ADMIN"],
  ] as const)("shows Create for %s, which holds the capability", (role) => {
    expect(hasCapability([role], "opportunity:create")).toBe(true);
    expect(canAccessFeature(createFeature, [role])).toBe(true);
    expect(mobileNavFor([role])).toContain("Create");
  });

  it.each([["MEMBER"], ["FREELANCER"], ["INVESTOR"]] as const)(
    "hides Create for %s, which lacks the capability",
    (role) => {
      // Navigation must not advertise a destination that would 404.
      expect(hasCapability([role], "opportunity:create")).toBe(false);
      expect(canAccessFeature(createFeature, [role])).toBe(false);
      expect(mobileNavFor([role])).not.toContain("Create");
    },
  );

  it("never advertises Create to a role the destination would reject", () => {
    const roles: RoleName[] = [
      "ADMIN",
      "CLIENT",
      "FOUNDER",
      "FREELANCER",
      "INVESTOR",
      "MASTER_ADMIN",
      "MEMBER",
      "PROPERTY_OWNER",
    ];
    for (const role of roles) {
      expect(canAccessFeature(createFeature, [role])).toBe(
        hasCapability([role], "opportunity:create"),
      );
    }
  });

  it("keeps the remaining primary destinations available to every role", () => {
    for (const role of ["MEMBER", "CLIENT"] as const) {
      const labels = mobileNavFor([role]);
      expect(labels).toEqual(
        expect.arrayContaining(["Home", "Network", "Messages", "Profile"]),
      );
    }
  });
});
