import { describe, expect, it } from "vitest";

import { usernameSchema } from "@/lib/validation/auth";

describe("profile edit validation", () => {
  it("normalizes valid usernames for public profile URLs", () => {
    expect(usernameSchema.parse("  Founder_42 ")).toBe("founder_42");
  });

  it("rejects reserved usernames that collide with app and admin routes", () => {
    expect(usernameSchema.safeParse("admin").success).toBe(false);
    expect(usernameSchema.safeParse("sign-in").success).toBe(false);
    expect(usernameSchema.safeParse("u").success).toBe(false);
  });

  it("rejects unsupported username characters", () => {
    expect(usernameSchema.safeParse("bad/route").success).toBe(false);
    expect(usernameSchema.safeParse("bad user").success).toBe(false);
  });
});
