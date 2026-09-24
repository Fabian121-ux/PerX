import { afterEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ query: vi.fn(), log: vi.fn() }));
vi.mock("@/lib/data/public-opportunities", () => ({
  getPublicOpportunityPage: mocks.query,
}));
vi.mock("@/lib/logging/runtime", () => ({ logServerDataError: mocks.log }));
import { getPublicFeedResult } from "@/lib/data/public-feed";
afterEach(() => vi.clearAllMocks());
it("distinguishes a failed query from empty content without substitute posts", async () => {
  mocks.query.mockRejectedValue(new Error("unavailable"));
  expect(await getPublicFeedResult()).toEqual({ posts: [], unavailable: true });
  expect(mocks.log).toHaveBeenCalledOnce();
});
it("requests a bounded page without viewer input", async () => {
  mocks.query.mockResolvedValue({ items: [] });
  expect(await getPublicFeedResult()).toEqual({
    posts: [],
    unavailable: false,
  });
  expect(mocks.query).toHaveBeenCalledWith({ pageSize: 12 });
});
it("preserves Next navigation control flow", async () => {
  const error = Object.assign(new Error("NEXT_REDIRECT"), {
    digest: "NEXT_REDIRECT;replace;/app;307;",
  });
  mocks.query.mockRejectedValue(error);
  await expect(getPublicFeedResult()).rejects.toBe(error);
  expect(mocks.log).not.toHaveBeenCalled();
});
