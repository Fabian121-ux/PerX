import { describe, expect, it } from "vitest";

import { getSafeAuthRedirect } from "@/lib/auth/redirects";

describe("auth redirect safety", () => {
  it("allows internal application callbacks", () => {
    expect(getSafeAuthRedirect("/app/messages?tab=unread")).toBe(
      "/app/messages?tab=unread",
    );
  });

  it("rejects absolute and protocol-relative callbacks", () => {
    expect(getSafeAuthRedirect("https://example.com/phish")).toBe("/app");
    expect(getSafeAuthRedirect("//example.com/phish")).toBe("/app");
  });

  it("rejects auth-loop callbacks", () => {
    expect(getSafeAuthRedirect("/sign-in")).toBe("/app");
    expect(getSafeAuthRedirect("/sign-up")).toBe("/app");
  });
});
