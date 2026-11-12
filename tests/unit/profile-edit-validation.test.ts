import { describe, expect, it } from "vitest";

import { personNameSchema, usernameSchema } from "@/lib/validation/auth";

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


describe("human-readable display name validation", () => {
  it.each([
    "Ada Lovelace",
    "Onyinye",
    "O'Connor",
    "Jean-Luc Picard",
    "Mary-Jane O’Connor",
    "José García",
    "李小龍",
    "McDonald",
    "J. R. R. Tolkien",
  ])("accepts a legitimate name: %s", (name) => {
    expect(personNameSchema.safeParse(name).success).toBe(true);
  });

  it.each([
    "QztemQSoaAZlvkSFX",
    "user123",
    "123456",
    "bad_name",
    "user@example.com",
    "random---id",
    "New PtahX member",
    "Deleted member",
    "Alex Alex",
  ])("rejects an identifier-like or invalid display name: %s", (name) => {
    expect(personNameSchema.safeParse(name).success).toBe(false);
  });
});
