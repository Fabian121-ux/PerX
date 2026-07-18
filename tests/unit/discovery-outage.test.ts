import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getPerXDataProvider } from "@/lib/data/provider";
import {
  getCategories,
  getOpportunityBySlug,
  getOpportunityFeedResult,
  getPublicDiscoveryData,
} from "@/lib/data/opportunities";
import { getPublicProfileResult } from "@/lib/data/profiles";

vi.mock("@/lib/data/provider", () => ({
  getPerXDataProvider: vi.fn(),
}));

const throwingProvider = {
  opportunities: {
    getCategories: vi.fn(async () => {
      throw new Error("database unavailable");
    }),
    getOpportunityBySlug: vi.fn(async () => {
      throw new Error("database unavailable");
    }),
    getOpportunityFeed: vi.fn(async () => {
      throw new Error("database unavailable");
    }),
  },
};

describe("public discovery outage handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getPerXDataProvider).mockResolvedValue(throwingProvider as never);
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns a controlled unavailable state instead of throwing", async () => {
    await expect(getPublicDiscoveryData()).resolves.toEqual({
      categories: [],
      opportunities: [],
      unavailable: true,
    });
  });

  it("keeps public category and detail helpers controlled", async () => {
    await expect(getCategories()).resolves.toEqual([]);
    await expect(getOpportunityBySlug("missing")).resolves.toBeNull();
  });

  it("handles provider resolution failures before a query runs", async () => {
    vi.mocked(getPerXDataProvider).mockRejectedValueOnce(
      new Error("Missing required environment variable(s): PERX_DATA_MODE."),
    );

    await expect(getOpportunityFeedResult()).resolves.toEqual({
      opportunities: [],
      unavailable: true,
    });
  });

  it("keeps public profile lookup controlled when provider resolution fails", async () => {
    vi.mocked(getPerXDataProvider).mockRejectedValueOnce(
      new Error("database unavailable"),
    );

    await expect(getPublicProfileResult("member")).resolves.toEqual({
      profile: null,
      unavailable: true,
    });
  });
});
