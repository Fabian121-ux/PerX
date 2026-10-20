import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  currentUser: vi.fn(),
  getSocialFeed: vi.fn(),
  logServerDataError: vi.fn(),
}));
vi.mock("@/lib/auth/session", () => ({ getCurrentUser: mocks.currentUser }));
vi.mock("@/lib/data/social-posts", () => ({ getSocialFeed: mocks.getSocialFeed }));
vi.mock("@/lib/logging/runtime", () => ({ logServerDataError: mocks.logServerDataError }));
import { GET } from "@/app/api/social-feed/route";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.currentUser.mockResolvedValue({ id: "user-1" });
  mocks.getSocialFeed.mockResolvedValue({ items: [], nextCursor: null });
});
describe("read-only social pagination API", () => {
  it("returns real viewer-scoped posts without shared caching", async () => {
    const result = await GET(new Request("https://ptahx.com/api/social-feed"));
    expect(result.status).toBe(200);
    expect(result.headers.get("Cache-Control")).toBe("private, no-store");
    expect(mocks.getSocialFeed).toHaveBeenCalledWith("user-1", undefined);
  });
  it("allows public browsing without inventing an account", async () => {
    mocks.currentUser.mockResolvedValue(null);
    await GET(new Request("https://ptahx.com/api/social-feed"));
    expect(mocks.getSocialFeed).toHaveBeenCalledWith(undefined, undefined);
  });
  it("rejects malformed cursors without hitting the database", async () => {
    const result = await GET(new Request("https://ptahx.com/api/social-feed?cursor=malformed"));
    expect(result.status).toBe(400);
    expect(mocks.getSocialFeed).not.toHaveBeenCalled();
  });
});
