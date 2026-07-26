import { describe, expect, it } from "vitest";

import { normalizeNotificationActionUrl } from "@/lib/notifications/action-url";
import { hasCapability } from "@/lib/permissions/capabilities";

describe("notification action URLs", () => {
  it("accepts safe relative app paths", () => {
    expect(normalizeNotificationActionUrl("/app/messages/clx123?from=notifications")).toBe(
      "/app/messages/clx123?from=notifications",
    );
    expect(normalizeNotificationActionUrl("/u/goodnews")).toBe("/u/goodnews");
  });

  it("rejects external, protocol-relative, JavaScript, admin, API and malformed paths", () => {
    expect(normalizeNotificationActionUrl("https://example.com")).toBeNull();
    expect(normalizeNotificationActionUrl("//example.com/path")).toBeNull();
    expect(normalizeNotificationActionUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeNotificationActionUrl("/admin/messages")).toBeNull();
    expect(normalizeNotificationActionUrl("/api/health")).toBeNull();
    expect(normalizeNotificationActionUrl("/app/messages\\bad")).toBeNull();
  });
});

describe("broadcast capability", () => {
  it("allows admins to create broadcasts without granting the capability to members", () => {
    expect(hasCapability(["ADMIN"], "broadcasts:create")).toBe(true);
    expect(hasCapability(["MEMBER"], "broadcasts:create")).toBe(false);
  });
});
