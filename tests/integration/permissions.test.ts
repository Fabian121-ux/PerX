import { describe, expect, it } from "vitest";

import { hasCapability } from "@/lib/permissions/capabilities";

describe("capabilities", () => {
  it("allows one account to hold multiple roles", () => {
    expect(hasCapability(["CLIENT", "FREELANCER"], "opportunity:create")).toBe(true);
    expect(hasCapability(["CLIENT", "FREELANCER"], "proposal:create")).toBe(true);
  });

  it("does not grant admin capabilities to ordinary roles", () => {
    expect(hasCapability(["CLIENT"], "admin:access")).toBe(false);
  });
});
