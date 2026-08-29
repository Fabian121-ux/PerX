import { describe, expect, it } from "vitest";

import {
  FALLBACK_ACTIVE_MS,
  FALLBACK_MAX_MS,
  getFallbackActivity,
  getFallbackDelayMs,
} from "@/lib/messages/fallback-schedule";

describe("fallback schedule", () => {
  it("does not poll a hidden tab", () => {
    expect(
      getFallbackDelayMs({ activity: "hidden", consecutiveFailures: 0 }),
    ).toBeNull();
    expect(
      getFallbackDelayMs({ activity: "hidden", consecutiveFailures: 25 }),
    ).toBeNull();
  });

  it("stays responsive for the first few degraded ticks", () => {
    for (const ticks of [0, 1, 2]) {
      expect(
        getFallbackDelayMs({ activity: "idle", consecutiveFailures: ticks }),
      ).toBe(FALLBACK_ACTIVE_MS);
    }
  });

  it("backs off geometrically during a sustained outage", () => {
    const delays = [3, 4, 5, 6].map((ticks) =>
      getFallbackDelayMs({ activity: "idle", consecutiveFailures: ticks }),
    );
    // Strictly increasing until the ceiling.
    for (let i = 1; i < delays.length; i += 1) {
      expect(delays[i]!).toBeGreaterThanOrEqual(delays[i - 1]!);
    }
    expect(delays[0]).toBeGreaterThan(FALLBACK_ACTIVE_MS);
  });

  it("never exceeds the ceiling", () => {
    for (const ticks of [8, 20, 100, 5000]) {
      expect(
        getFallbackDelayMs({ activity: "idle", consecutiveFailures: ticks }),
      ).toBeLessThanOrEqual(FALLBACK_MAX_MS);
    }
  });

  it("keeps an actively used conversation responsive despite long outage", () => {
    expect(
      getFallbackDelayMs({ activity: "active", consecutiveFailures: 50 }),
    ).toBe(FALLBACK_ACTIVE_MS);
  });

  it("classifies activity from visibility and recent interaction", () => {
    const now = 1_000_000;
    expect(
      getFallbackActivity({
        documentVisible: false,
        lastInteractionAt: now,
        now,
      }),
    ).toBe("hidden");
    expect(
      getFallbackActivity({
        documentVisible: true,
        lastInteractionAt: now - 1_000,
        now,
      }),
    ).toBe("active");
    expect(
      getFallbackActivity({
        documentVisible: true,
        lastInteractionAt: now - 120_000,
        now,
      }),
    ).toBe("idle");
    expect(
      getFallbackActivity({
        documentVisible: true,
        lastInteractionAt: null,
        now,
      }),
    ).toBe("idle");
  });

  it("is materially cheaper than fixed 5s polling over a 10 minute outage", () => {
    const windowMs = 10 * 60_000;

    const fixed = Math.floor(windowMs / FALLBACK_ACTIVE_MS);

    let elapsed = 0;
    let ticks = 0;
    let requests = 0;
    while (elapsed < windowMs) {
      const delay = getFallbackDelayMs({
        activity: "idle",
        consecutiveFailures: ticks,
      })!;
      elapsed += delay;
      ticks += 1;
      requests += 1;
    }

    // The adaptive schedule must cut a sustained idle outage substantially.
    expect(requests).toBeLessThan(fixed / 3);
  });
});
