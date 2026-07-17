import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getPerXDataProvider } from "@/lib/data/provider";
import { getCategories, getOpportunityBySlug, getPublicDiscoveryData } from "@/lib/data/opportunities";

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
});
