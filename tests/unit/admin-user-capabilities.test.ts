import { describe, expect, it } from "vitest";

import { hasCapability, type RoleName } from "@/lib/permissions/capabilities";

const NON_ADMIN_ROLES: RoleName[] = [
  "CLIENT",
  "FOUNDER",
  "FREELANCER",
  "INTERNAL_TESTER",
  "INVESTOR",
  "MEMBER",
  "PROPERTY_OWNER",
];

describe("admin user-management capabilities", () => {
  it("grants session revocation to administrator roles only", () => {
    expect(hasCapability(["MASTER_ADMIN"], "users:sessions:revoke")).toBe(true);
    expect(hasCapability(["ADMIN"], "users:sessions:revoke")).toBe(true);

    for (const role of NON_ADMIN_ROLES) {
      expect(
        hasCapability([role], "users:sessions:revoke"),
        `${role} must not revoke sessions`,
      ).toBe(false);
    }
  });

  it("keeps enforcement restricted to MASTER_ADMIN", () => {
    // Suspension, deactivation and bans stay narrower than session revocation.
    // Adding a user-management surface must not widen who can apply them.
    expect(hasCapability(["MASTER_ADMIN"], "enforcement:manage")).toBe(true);
    expect(hasCapability(["ADMIN"], "enforcement:manage")).toBe(false);
  });

  it("does not conflate revoking sessions with resetting a password", () => {
    // Distinct capabilities: one interrupts every device immediately, the other
    // sends a link the account holder chooses to act on.
    for (const role of NON_ADMIN_ROLES) {
      expect(hasCapability([role], "users:manage")).toBe(false);
    }
  });

  it("still withholds every user-management capability from MEMBER", () => {
    expect(hasCapability(["MEMBER"], "users:read")).toBe(false);
    expect(hasCapability(["MEMBER"], "users:manage")).toBe(false);
    expect(hasCapability(["MEMBER"], "users:sessions:revoke")).toBe(false);
    expect(hasCapability(["MEMBER"], "admin:access")).toBe(false);
  });

  it("leaves MEMBER without any content-creation capability", () => {
    // Recorded so a future role change is a deliberate, reviewed decision
    // rather than an accident: MEMBER currently holds nothing at all.
    expect(hasCapability(["MEMBER"], "opportunity:create")).toBe(false);
  });
});
