import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  bookmarkFindMany: vi.fn(),
  getCurrentUser: vi.fn(),
  getHomeFeedPage: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/lib/db/prisma", () => ({
  getPrisma: () => ({
    opportunityBookmark: { findMany: mocks.bookmarkFindMany },
  }),
}));
vi.mock("@/lib/data/home-feed", async () => {
  const actual = await vi.importActual<typeof import("@/lib/data/home-feed")>(
    "@/lib/data/home-feed",
  );
  return { ...actual, getHomeFeedPage: mocks.getHomeFeedPage };
});

import { GET } from "@/app/api/home-feed/route";
import { MAX_HOME_FEED_PAGE_SIZE } from "@/lib/data/home-feed";

const BASE = "http://127.0.0.1:3100/api/home-feed";

function emptyPage(overrides = {}) {
  return {
    cursor: null,
    items: [],
    nextCursor: null,
    nextSegment: null,
    pageSize: 12,
    segment: "network",
    ...overrides,
  };
}

describe("home feed API route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentUser.mockResolvedValue({ id: "viewer-1" });
    mocks.getHomeFeedPage.mockResolvedValue(emptyPage());
    mocks.bookmarkFindMany.mockResolvedValue([]);
  });

  it("requires authentication", async () => {
    mocks.getCurrentUser.mockResolvedValue(null);

    const response = await GET(new Request(BASE));

    expect(response.status).toBe(401);
    // Authorization is re-checked per page: a cursor is not a capability.
    expect(mocks.getHomeFeedPage).not.toHaveBeenCalled();
  });

  it("scopes the query to the authenticated viewer, not a client-supplied id", async () => {
    await GET(new Request(`${BASE}?viewerId=someone-else`));

    expect(mocks.getHomeFeedPage).toHaveBeenCalledWith(
      expect.objectContaining({ viewerId: "viewer-1" }),
    );
  });

  it("rejects a malformed cursor before querying", async () => {
    const response = await GET(new Request(`${BASE}?cursor=%21%21%21`));

    expect(response.status).toBe(400);
    expect(mocks.getHomeFeedPage).not.toHaveBeenCalled();
  });

  it("translates a cursor scope violation into a client error", async () => {
    mocks.getHomeFeedPage.mockRejectedValue(new Error("Invalid cursor scope."));

    const response = await GET(new Request(BASE));

    expect(response.status).toBe(400);
  });

  it("lets genuine failures surface rather than faking an empty feed", async () => {
    mocks.getHomeFeedPage.mockRejectedValue(new Error("connection lost"));

    // A 500 makes the client show its retry state; a silent empty page would
    // look like the end of the feed.
    await expect(GET(new Request(BASE))).rejects.toThrow("connection lost");
  });

  it("rejects an invalid segment", async () => {
    const response = await GET(new Request(`${BASE}?segment=everything`));

    expect(response.status).toBe(400);
    expect(mocks.getHomeFeedPage).not.toHaveBeenCalled();
  });

  it("accepts the two known segments", async () => {
    for (const segment of ["network", "discovery"]) {
      const response = await GET(new Request(`${BASE}?segment=${segment}`));
      expect(response.status).toBe(200);
    }
  });

  it("rejects an out-of-range page size", async () => {
    for (const size of [0, -1, MAX_HOME_FEED_PAGE_SIZE + 1, 10_000]) {
      const response = await GET(new Request(`${BASE}?pageSize=${size}`));
      expect(response.status).toBe(400);
    }
    expect(mocks.getHomeFeedPage).not.toHaveBeenCalled();
  });

  it("rejects a non-integer page size", async () => {
    const response = await GET(new Request(`${BASE}?pageSize=abc`));

    expect(response.status).toBe(400);
  });

  it("never caches a viewer-scoped, block-sensitive response", async () => {
    const response = await GET(new Request(BASE));

    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("returns the continuation contract the client needs", async () => {
    mocks.getHomeFeedPage.mockResolvedValue(
      emptyPage({ nextCursor: "next", nextSegment: "network" }),
    );

    const body = await (await GET(new Request(BASE))).json();

    expect(body).toMatchObject({
      items: [],
      nextCursor: "next",
      nextSegment: "network",
      segment: "network",
    });
  });

  it("resolves saved state in one batched query, not per post", async () => {
    mocks.getHomeFeedPage.mockResolvedValue(
      emptyPage({
        items: [
          {
            budgetMaxMinor: null,
            budgetMinMinor: null,
            currency: "NGN",
            id: "o1",
            images: [],
            location: null,
            owner: {
              emailVerifiedAt: null,
              id: "author-1",
              imageUrl: null,
              name: "Author",
              profile: null,
              username: "author",
              verificationStatus: "UNVERIFIED",
            },
            publishedAt: new Date("2026-08-01T12:00:00.000Z"),
            remote: true,
            slug: "slug-o1",
            summary: "Summary",
            title: "Post",
            type: "JOB",
          },
        ],
      }),
    );
    mocks.bookmarkFindMany.mockResolvedValue([{ opportunityId: "o1" }]);

    const body = await (await GET(new Request(BASE))).json();

    expect(mocks.bookmarkFindMany).toHaveBeenCalledTimes(1);
    expect(mocks.bookmarkFindMany).toHaveBeenCalledWith({
      select: { opportunityId: true },
      where: { opportunityId: { in: ["o1"] }, userId: "viewer-1" },
    });
    expect(body.items[0].viewerHasSaved).toBe(true);
  });

  it("serialises BigInt budgets and Date timestamps as JSON-safe values", async () => {
    mocks.getHomeFeedPage.mockResolvedValue(
      emptyPage({
        items: [
          {
            budgetMaxMinor: 5_000_000n,
            budgetMinMinor: 1_000_000n,
            currency: "NGN",
            id: "o1",
            images: [],
            location: null,
            owner: {
              emailVerifiedAt: null,
              id: "author-1",
              imageUrl: null,
              name: "Author",
              profile: null,
              username: "author",
              verificationStatus: "UNVERIFIED",
            },
            publishedAt: new Date("2026-08-01T12:00:00.000Z"),
            remote: true,
            slug: "slug-o1",
            summary: "Summary",
            title: "Post",
            type: "JOB",
          },
        ],
      }),
    );

    const body = await (await GET(new Request(BASE))).json();

    // BigInt cannot cross a JSON boundary; it must already be a string.
    expect(body.items[0].budgetMinMinor).toBe("1000000");
    expect(body.items[0].publishedAt).toBe("2026-08-01T12:00:00.000Z");
  });
});
