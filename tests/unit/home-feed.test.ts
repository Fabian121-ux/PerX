import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  connectionFindMany: vi.fn(),
  dealParticipantGroupBy: vi.fn(),
  opportunityFindMany: vi.fn(),
  reviewGroupBy: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  getPrisma: () => ({
    connection: { findMany: mocks.connectionFindMany },
    dealParticipant: { groupBy: mocks.dealParticipantGroupBy },
    opportunity: { findMany: mocks.opportunityFindMany },
    review: { groupBy: mocks.reviewGroupBy },
  }),
}));

import { encodeCursor } from "@/lib/data/cursor";
import {
  applyAuthorDiversity,
  clampHomeFeedPageSize,
  DEFAULT_HOME_FEED_PAGE_SIZE,
  getAcceptedConnectionIds,
  getHomeFeedPage,
  getHomeFeedPageResult,
  getHomeFeedScope,
  MAX_HOME_FEED_PAGE_SIZE,
} from "@/lib/data/home-feed";

const VIEWER = "viewer-1";

function row(id: string, ownerId: string, minutesAgo: number) {
  return {
    budgetMaxMinor: null,
    budgetMinMinor: null,
    currency: "NGN",
    id,
    images: [],
    location: null,
    owner: {
      emailVerifiedAt: null,
      id: ownerId,
      imageUrl: null,
      name: `Owner ${ownerId}`,
      profile: { profileCompleteness: 50, profileImageUrl: null },
      username: ownerId,
      verificationStatus: "UNVERIFIED",
    },
    publishedAt: new Date(Date.now() - minutesAgo * 60_000),
    remote: true,
    slug: `slug-${id}`,
    summary: "Summary",
    title: `Post ${id}`,
    type: "JOB",
  };
}

/** The `where` Prisma was called with, for assertion. */
function lastWhere() {
  return mocks.opportunityFindMany.mock.calls.at(-1)?.[0]?.where;
}

/** Flatten a nested Prisma where clause so predicates can be located anywhere. */
function flatten(value: unknown, out: Record<string, unknown>[] = []) {
  if (!value || typeof value !== "object") return out;
  if (Array.isArray(value)) {
    value.forEach((entry) => flatten(entry, out));
    return out;
  }
  out.push(value as Record<string, unknown>);
  Object.values(value).forEach((entry) => flatten(entry, out));
  return out;
}

describe("home feed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.connectionFindMany.mockResolvedValue([]);
    mocks.opportunityFindMany.mockResolvedValue([]);
    mocks.dealParticipantGroupBy.mockResolvedValue([]);
    mocks.reviewGroupBy.mockResolvedValue([]);
  });

  describe("page size is bounded", () => {
    it("defaults to a small initial page rather than the whole table", () => {
      expect(clampHomeFeedPageSize(undefined)).toBe(DEFAULT_HOME_FEED_PAGE_SIZE);
      expect(DEFAULT_HOME_FEED_PAGE_SIZE).toBeLessThanOrEqual(20);
      expect(DEFAULT_HOME_FEED_PAGE_SIZE).toBeGreaterThanOrEqual(10);
    });

    it("clamps hostile page sizes", () => {
      expect(clampHomeFeedPageSize(10_000)).toBe(MAX_HOME_FEED_PAGE_SIZE);
      expect(clampHomeFeedPageSize(0)).toBe(1);
      expect(clampHomeFeedPageSize(-5)).toBe(1);
      expect(clampHomeFeedPageSize(Number.NaN)).toBe(DEFAULT_HOME_FEED_PAGE_SIZE);
    });

    it("requests only pageSize + 1 rows, never an unbounded scan", async () => {
      await getHomeFeedPage({ viewerId: VIEWER });

      const call = mocks.opportunityFindMany.mock.calls[0][0];
      expect(call.take).toBe(DEFAULT_HOME_FEED_PAGE_SIZE + 1);
      // A `select` rather than a full-row read: feed cards need a subset.
      expect(call.select).toBeDefined();
      expect(call.include).toBeUndefined();
    });

    it("does not select heavy columns the feed card never renders", async () => {
      await getHomeFeedPage({ viewerId: VIEWER });

      const { select } = mocks.opportunityFindMany.mock.calls[0][0];
      expect(select.description).toBeUndefined();
      expect(select.skills).toBeUndefined();
      // At most one image is needed for the card's single media slot.
      expect(select.images.take).toBe(1);
    });
  });

  describe("visibility and security", () => {
    it("requires published, approved, non-null publishedAt", async () => {
      await getHomeFeedPage({ viewerId: VIEWER });

      const clauses = flatten(lastWhere());
      expect(
        clauses.some(
          (c) =>
            c.status === "PUBLISHED" &&
            c.moderationStatus === "APPROVED" &&
            JSON.stringify(c.publishedAt) === JSON.stringify({ not: null }),
        ),
      ).toBe(true);
    });

    it("excludes authors who blocked the viewer or were blocked by them", async () => {
      await getHomeFeedPage({ viewerId: VIEWER });

      const owners = flatten(lastWhere())
        .map((c) => c.owner)
        .filter(Boolean) as Record<string, unknown>[];
      expect(owners.length).toBeGreaterThan(0);
      const owner = owners[0];

      expect(owner.blocksMade).toEqual({ none: { blockedUserId: VIEWER } });
      expect(owner.blocksReceived).toEqual({ none: { blockerUserId: VIEWER } });
    });

    it("excludes suspended, banned, deactivated and non-discoverable authors", async () => {
      await getHomeFeedPage({ viewerId: VIEWER });

      const owner = flatten(lastWhere()).find((c) => c.owner)?.owner as Record<
        string,
        unknown
      >;
      expect(owner.bannedAt).toBeNull();
      expect(owner.deactivatedAt).toBeNull();
      expect(owner.isActive).toBe(true);
      expect(owner.accountClassification).toBe("PUBLIC_BETA_USER");
      expect(owner.profile).toEqual({ is: { isDiscoverable: true } });
    });

    it("keeps the discovery segment inside the same visibility filter", async () => {
      await getHomeFeedPage({ segment: "discovery", viewerId: VIEWER });

      const clauses = flatten(lastWhere());
      // Discovery must not be a bypass: the same block and moderation rules
      // still have to appear in its query.
      expect(
        clauses.some(
          (c) => c.status === "PUBLISHED" && c.moderationStatus === "APPROVED",
        ),
      ).toBe(true);
      const owner = clauses.find((c) => c.owner)?.owner as Record<string, unknown>;
      expect(owner.blocksMade).toEqual({ none: { blockedUserId: VIEWER } });
    });
  });

  describe("cursor pagination", () => {
    it("orders deterministically by publishedAt then id", async () => {
      await getHomeFeedPage({ viewerId: VIEWER });

      expect(mocks.opportunityFindMany.mock.calls[0][0].orderBy).toEqual([
        { publishedAt: "desc" },
        { id: "desc" },
      ]);
    });

    it("returns no next cursor when the page is not full", async () => {
      mocks.opportunityFindMany.mockResolvedValue([row("o1", "a", 1)]);

      const page = await getHomeFeedPage({ viewerId: VIEWER });

      expect(page.nextCursor).toBeNull();
      expect(page.items).toHaveLength(1);
    });

    it("emits a next cursor and trims the probe row when a page is full", async () => {
      const rows = Array.from({ length: DEFAULT_HOME_FEED_PAGE_SIZE + 1 }, (_, i) =>
        row(`o${i}`, `author-${i}`, i),
      );
      mocks.opportunityFindMany.mockResolvedValue(rows);

      const page = await getHomeFeedPage({ viewerId: VIEWER });

      expect(page.items).toHaveLength(DEFAULT_HOME_FEED_PAGE_SIZE);
      expect(page.nextCursor).toBeTruthy();
      // The probe row must not be shown, or it would also appear on page 2.
      expect(page.items.some((i) => i.id === `o${DEFAULT_HOME_FEED_PAGE_SIZE}`)).toBe(
        false,
      );
    });

    it("applies the keyset predicate when given a cursor", async () => {
      const timestamp = new Date("2026-08-01T12:00:00.000Z");
      const cursor = encodeCursor({
        id: "o5",
        scope: getHomeFeedScope(VIEWER, "network"),
        timestamp,
      });

      await getHomeFeedPage({ cursor, viewerId: VIEWER });

      const predicate = flatten(lastWhere()).find(
        (c) => Array.isArray(c.OR) && c.OR.length === 2 && !c.AND,
      );
      expect(JSON.stringify(lastWhere())).toContain(timestamp.toISOString());
      expect(predicate).toBeDefined();
    });

    it("rejects a cursor minted for another viewer", async () => {
      const cursor = encodeCursor({
        id: "o5",
        scope: getHomeFeedScope("someone-else", "network"),
        timestamp: new Date(),
      });

      await expect(
        getHomeFeedPage({ cursor, viewerId: VIEWER }),
      ).rejects.toThrow("Invalid cursor scope.");
      expect(mocks.opportunityFindMany).not.toHaveBeenCalled();
    });

    it("rejects a malformed cursor before querying", async () => {
      await expect(
        getHomeFeedPage({ cursor: "!!!not-a-cursor!!!", viewerId: VIEWER }),
      ).rejects.toThrow("Invalid cursor.");
      expect(mocks.opportunityFindMany).not.toHaveBeenCalled();
    });
  });

  describe("network and discovery segments", () => {
    it("restricts the network segment to the viewer and their connections", async () => {
      mocks.connectionFindMany.mockResolvedValue([
        { receiverId: "friend-1", requesterId: VIEWER },
        { receiverId: VIEWER, requesterId: "friend-2" },
      ]);
      mocks.opportunityFindMany.mockResolvedValue([row("o1", "friend-1", 1)]);

      await getHomeFeedPage({ viewerId: VIEWER });

      const ownerFilter = flatten(lastWhere()).find(
        (c) => c.ownerId && typeof c.ownerId === "object" && "in" in c.ownerId,
      );
      expect(ownerFilter?.ownerId).toEqual({
        in: [VIEWER, "friend-1", "friend-2"],
      });
    });

    it("includes the viewer's own posts so publishing is visible", async () => {
      mocks.opportunityFindMany.mockResolvedValue([row("o1", VIEWER, 1)]);

      const page = await getHomeFeedPage({ viewerId: VIEWER });

      expect(page.items[0].owner.id).toBe(VIEWER);
    });

    it("excludes network authors from discovery so posts are never duplicated", async () => {
      mocks.connectionFindMany.mockResolvedValue([
        { receiverId: "friend-1", requesterId: VIEWER },
      ]);

      await getHomeFeedPage({ segment: "discovery", viewerId: VIEWER });

      const ownerFilter = flatten(lastWhere()).find(
        (c) => c.ownerId && typeof c.ownerId === "object" && "notIn" in c.ownerId,
      );
      expect(ownerFilter?.ownerId).toEqual({ notIn: [VIEWER, "friend-1"] });
    });

    it("falls through to discovery when the network yields nothing", async () => {
      mocks.connectionFindMany.mockResolvedValue([]);
      mocks.opportunityFindMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([row("o1", "stranger", 1)]);

      const page = await getHomeFeedPage({ viewerId: VIEWER });

      // A new user with no connections must still see a populated feed.
      expect(page.segment).toBe("discovery");
      expect(page.items).toHaveLength(1);
      expect(mocks.opportunityFindMany).toHaveBeenCalledTimes(2);
    });

    it("hands off to discovery when the network segment is exhausted", async () => {
      mocks.connectionFindMany.mockResolvedValue([
        { receiverId: "friend-1", requesterId: VIEWER },
      ]);
      mocks.opportunityFindMany.mockResolvedValue([row("o1", "friend-1", 1)]);

      const page = await getHomeFeedPage({ viewerId: VIEWER });

      // No next cursor within network, so the stream continues in discovery
      // rather than ending prematurely.
      expect(page.nextCursor).toBeNull();
      expect(page.nextSegment).toBe("discovery");
    });

    it("reports no continuation once discovery is exhausted", async () => {
      mocks.opportunityFindMany.mockResolvedValue([row("o1", "stranger", 1)]);

      const page = await getHomeFeedPage({ segment: "discovery", viewerId: VIEWER });

      expect(page.nextCursor).toBeNull();
      expect(page.nextSegment).toBeNull();
    });

    it("deduplicates connection ids and drops the viewer", async () => {
      mocks.connectionFindMany.mockResolvedValue([
        { receiverId: "friend-1", requesterId: VIEWER },
        { receiverId: "friend-1", requesterId: VIEWER },
        { receiverId: VIEWER, requesterId: VIEWER },
      ]);

      const ids = await getAcceptedConnectionIds(VIEWER);

      expect(ids).toEqual(["friend-1"]);
    });

    it("only counts accepted connections", async () => {
      await getAcceptedConnectionIds(VIEWER);

      const where = mocks.connectionFindMany.mock.calls[0][0].where;
      expect(where.status).toBe("ACCEPTED");
      expect(where.OR).toEqual([
        { requesterId: VIEWER },
        { receiverId: VIEWER },
      ]);
    });
  });

  describe("author diversity", () => {
    it("breaks up a run by a single author when alternatives exist", () => {
      const items = [
        { id: "1", owner: { id: "a" } },
        { id: "2", owner: { id: "a" } },
        { id: "3", owner: { id: "a" } },
        { id: "4", owner: { id: "a" } },
        { id: "5", owner: { id: "b" } },
        { id: "6", owner: { id: "c" } },
      ];

      const ordered = applyAuthorDiversity(items, 2);

      let streak = 0;
      let last: string | null = null;
      for (const item of ordered) {
        streak = item.owner.id === last ? streak + 1 : 1;
        last = item.owner.id;
        expect(streak).toBeLessThanOrEqual(2);
      }
    });

    it("never adds or drops posts while reordering", () => {
      const items = Array.from({ length: 9 }, (_, i) => ({
        id: `${i}`,
        owner: { id: i < 6 ? "a" : `b${i}` },
      }));

      const ordered = applyAuthorDiversity(items, 2);

      expect(ordered).toHaveLength(items.length);
      expect(new Set(ordered.map((i) => i.id))).toEqual(
        new Set(items.map((i) => i.id)),
      );
    });

    it("leaves a single-author feed intact rather than emptying it", () => {
      const items = Array.from({ length: 5 }, (_, i) => ({
        id: `${i}`,
        owner: { id: "a" },
      }));

      expect(applyAuthorDiversity(items, 2).map((i) => i.id)).toEqual([
        "0",
        "1",
        "2",
        "3",
        "4",
      ]);
    });

    it("keeps the keyset boundary on the recency-ordered last row", async () => {
      // Diversity reorders the page, but the cursor must still continue from
      // the oldest fetched row or pages would overlap or skip.
      const rows = [
        ...Array.from({ length: DEFAULT_HOME_FEED_PAGE_SIZE }, (_, i) =>
          row(`o${i}`, "prolific", i),
        ),
        row("boundary", "other", 999),
      ];
      mocks.opportunityFindMany.mockResolvedValue(rows);

      const page = await getHomeFeedPage({ viewerId: VIEWER });

      expect(page.nextCursor).toBeTruthy();
      // `boundary` is the probe row and must not be rendered.
      expect(page.items.some((i) => i.id === "boundary")).toBe(false);
    });
  });

  describe("degradation", () => {
    it("reports unavailable instead of throwing when the query fails", async () => {
      mocks.opportunityFindMany.mockRejectedValue(new Error("db down"));

      const page = await getHomeFeedPageResult({ viewerId: VIEWER });

      expect(page.unavailable).toBe(true);
      expect(page.items).toEqual([]);
      expect(page.nextCursor).toBeNull();
    });

    it("still surfaces cursor errors as errors, not outages", async () => {
      await expect(
        getHomeFeedPageResult({ cursor: "###", viewerId: VIEWER }),
      ).rejects.toThrow("Invalid cursor.");
    });
  });
});
