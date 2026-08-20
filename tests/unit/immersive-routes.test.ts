import { describe, expect, it } from "vitest";

import {
  isDistractionFreeRoute,
  isImmersiveRoute,
  isMobileConversationRoute,
} from "@/lib/navigation/immersive-routes";

describe("immersive route classification", () => {
  it("treats the composer routes as full-screen at every breakpoint", () => {
    expect(isDistractionFreeRoute("/app/opportunities/new")).toBe(true);
    expect(isDistractionFreeRoute("/app/opportunities/abc-123/edit")).toBe(
      true,
    );
    expect(isImmersiveRoute("/app/opportunities/new")).toBe(
      "distraction-free",
    );
  });

  it("does not treat listing browse or detail routes as immersive", () => {
    expect(isDistractionFreeRoute("/app/opportunities")).toBe(false);
    expect(isDistractionFreeRoute("/app/opportunities/abc-123")).toBe(false);
    expect(isImmersiveRoute("/app/opportunities/abc-123")).toBeNull();
  });

  it("treats a single conversation as mobile-only immersive, but not the inbox", () => {
    expect(isMobileConversationRoute("/app/messages/thread-1")).toBe(true);
    expect(isImmersiveRoute("/app/messages/thread-1")).toBe(
      "mobile-conversation",
    );

    expect(isMobileConversationRoute("/app/messages")).toBe(false);
    expect(isImmersiveRoute("/app/messages")).toBeNull();
  });

  it("keeps ordinary routes non-immersive", () => {
    for (const pathname of [
      "/app",
      "/app/profile",
      "/app/connections",
      "/app/search",
      "/app/notifications",
    ]) {
      expect(isImmersiveRoute(pathname)).toBeNull();
    }
  });
});
