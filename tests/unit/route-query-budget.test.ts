import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Database query budgets.
 *
 * Counts the Prisma operations each server data function issues, so an
 * accidental N+1 or a duplicated lookup fails here instead of silently
 * degrading Production.
 *
 * Budgets are upper bounds on operation COUNT, not timings, so the suite is
 * unaffected by CI hardware speed.
 */

const calls: string[] = [];

/**
 * Counting Prisma stub.
 *
 * Records `model.operation` for every call. Returns empty results, which is
 * enough to exercise the query-shaping code under test - the assertion is
 * about how many operations are issued, not what they return.
 */
function countingPrisma(overrides: Record<string, unknown> = {}) {
  const handler: ProxyHandler<Record<string, unknown>> = {
    get(target, model: string) {
      // Client-root members such as `$queryRaw` are real properties, not
      // models, so they must be returned before the model proxy is built.
      if (model.startsWith("$")) return Reflect.get(target, model);
      if (model in overrides) return overrides[model];
      return new Proxy(
        {},
        {
          get(_inner, operation: string) {
            return (...args: unknown[]) => {
              calls.push(`${model}.${operation}`);
              const custom = (
                overrides as Record<string, Record<string, unknown>>
              )[model]?.[operation];
              if (typeof custom === "function") {
                return (custom as (...a: unknown[]) => unknown)(...args);
              }
              if (operation === "count") return Promise.resolve(0);
              if (operation === "groupBy") return Promise.resolve([]);
              if (operation === "findMany") return Promise.resolve([]);
              return Promise.resolve(null);
            };
          },
        },
      );
    },
  };
  return new Proxy({}, handler);
}

const mocks = vi.hoisted(() => ({
  prisma: { current: null as unknown },
  queryRaw: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  getPrisma: () => mocks.prisma.current,
}));

import { getHomeFeedPage } from "@/lib/data/home-feed";
import { getTrustRecordEvidenceByUserIds } from "@/lib/trust/records";
import { getUnreadCounts } from "@/lib/data/unread-counts";

function installPrisma(overrides: Record<string, unknown> = {}) {
  const base = countingPrisma(overrides) as Record<string, unknown>;
  // `$queryRaw` is a tagged template on the client root, not a model.
  (base as { $queryRaw?: unknown }).$queryRaw = (...args: unknown[]) => {
    calls.push("$queryRaw");
    return mocks.queryRaw(...args);
  };
  mocks.prisma.current = base;
  return base;
}

describe("route query budgets", () => {
  beforeEach(() => {
    calls.length = 0;
    vi.clearAllMocks();
    mocks.queryRaw.mockResolvedValue([{ count: 0 }]);
  });

  describe("home feed", () => {
    it("issues a bounded number of operations for one page", async () => {
      installPrisma();

      await getHomeFeedPage({ viewerId: "viewer-1" });

      /*
        Expected shape for a first page:
          1. connection.findMany   - accepted connections
          2. opportunity.findMany  - the network segment
          3. opportunity.findMany  - discovery fallback (network was empty here)
          4. dealParticipant.groupBy + review.groupBy - batched trust evidence

        The number must not scale with the number of posts returned; anything
        per-post would be an N+1.
      */
      expect(calls.length).toBeLessThanOrEqual(6);
      expect(
        calls.filter((call) => call === "opportunity.findMany").length,
      ).toBeLessThanOrEqual(2);
    });

    it("does not issue a query per post", async () => {
      const posts = Array.from({ length: 12 }, (_, index) => ({
        budgetMaxMinor: null,
        budgetMinMinor: null,
        currency: "NGN",
        id: `o${index}`,
        images: [],
        location: null,
        owner: {
          emailVerifiedAt: null,
          id: `author-${index}`,
          imageUrl: null,
          name: `Author ${index}`,
          profile: null,
          username: `author${index}`,
          verificationStatus: "UNVERIFIED",
        },
        publishedAt: new Date(),
        remote: true,
        slug: `slug-${index}`,
        summary: "Summary",
        title: `Post ${index}`,
        type: "JOB",
      }));
      installPrisma({
        opportunity: { findMany: () => Promise.resolve(posts) },
      });

      await getHomeFeedPage({ viewerId: "viewer-1" });

      // 12 posts by 12 distinct authors must not produce 12 author lookups.
      const authorLookups = calls.filter(
        (call) => call.startsWith("user.") || call.startsWith("profile."),
      );
      expect(authorLookups).toHaveLength(0);
      expect(calls.length).toBeLessThanOrEqual(6);
    });
  });

  describe("trust evidence", () => {
    it("batches many authors into a fixed number of aggregate queries", async () => {
      installPrisma();
      const ids = Array.from({ length: 50 }, (_, index) => `user-${index}`);

      await getTrustRecordEvidenceByUserIds(ids);

      // Two grouped aggregates regardless of author count.
      expect(calls).toEqual(["dealParticipant.groupBy", "review.groupBy"]);
    });

    it("issues no query at all for an empty author list", async () => {
      installPrisma();

      await getTrustRecordEvidenceByUserIds([]);

      expect(calls).toHaveLength(0);
    });
  });

  describe("unread counts", () => {
    it("resolves every badge in a fixed number of parallel queries", async () => {
      installPrisma();

      await getUnreadCounts("viewer-1");

      // One raw conversation query plus three counts - constant, and issued
      // concurrently rather than as a waterfall.
      expect(calls).toHaveLength(4);
      expect(calls.filter((call) => call === "$queryRaw")).toHaveLength(1);
      expect(
        calls.filter((call) => call.endsWith(".count")).length,
      ).toBe(3);
    });
  });
});
