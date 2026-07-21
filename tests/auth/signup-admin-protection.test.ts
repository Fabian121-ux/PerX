import { describe, it, expect } from "vitest";
import { getCapabilities, normalizeRole } from "../../src/lib/permissions/capabilities";

describe("Public Signup Role Protection", () => {
  it("never grants ADMIN to MEMBER role", () => {
    const caps = getCapabilities(["MEMBER"]);
    expect(caps.has("admin:access")).toBe(false);
  });

  it("normalizes roles properly and doesn't allow random injection", () => {
    expect(normalizeRole("ADMIN")).toBe("ADMIN");
    expect(normalizeRole("FAKE_ROLE")).toBe(null);
  });
});
