import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Per-request deduplication contract.
 *
 * The authenticated layout and the page beneath it both need the same
 * viewer-scoped data: `src/app/app/layout.tsx` renders navigation badges and
 * `src/app/app/page.tsx` renders the same counts in Home's rail. Without
 * memoisation that is four database queries issued twice per page load.
 *
 * `React.cache` only memoises inside a server request scope, so these tests
 * assert the two things that are verifiable in isolation and that actually
 * break if the wrapper is removed:
 *
 *   1. the export is a `cache()`-wrapped function, not the raw loader
 *   2. the underlying loader issues a fixed, parallel set of queries
 *
 * Timing is deliberately not asserted, so the suite is unaffected by CI speed.
 */

const queries: string[] = [];

const mocks = vi.hoisted(() => ({
  queryRaw: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  getPrisma: () => {
    const model = (name: string) =>
      new Proxy(
        {},
        {
          get(_target, operation: string) {
            return () => {
              queries.push(`${name}.${operation}`);
              return Promise.resolve(0);
            };
          },
        },
      );
    return {
      $queryRaw: (...args: unknown[]) => {
        queries.push("$queryRaw");
        return mocks.queryRaw(...args);
      },
      connection: model("connection"),
      notification: model("notification"),
    };
  },
}));

import { getUnreadCounts } from "@/lib/data/unread-counts";
import { getCurrentUser } from "@/lib/auth/session";

describe("per-request deduplication", () => {
  beforeEach(() => {
    queries.length = 0;
    vi.clearAllMocks();
    mocks.queryRaw.mockResolvedValue([{ count: 0 }]);
  });

  it("exposes unread counts through a memoised wrapper", () => {
    /*
      `cache()` returns a distinct function object whose `length` is erased,
      which is how a wrapped export is distinguishable from the raw loader.
      `loadUnreadCounts` declares one parameter, so an unwrapped export would
      report `length === 1`.
    */
    expect(typeof getUnreadCounts).toBe("function");
    expect(getUnreadCounts.length).toBe(0);
  });

  it("memoises the current user the same way", () => {
    // Long-standing precedent in `src/lib/auth/session.ts`; unread counts were
    // brought in line with it.
    expect(getCurrentUser.length).toBe(0);
  });

  it("issues a fixed set of queries per resolution", async () => {
    await getUnreadCounts("viewer-1");

    // One raw conversation query plus three counts. Constant regardless of how
    // much mail or how many notifications the viewer has.
    expect(queries).toHaveLength(4);
    expect(queries.filter((query) => query === "$queryRaw")).toHaveLength(1);
    expect(queries.filter((query) => query.endsWith(".count"))).toHaveLength(3);
  });

  it("issues those queries concurrently rather than as a waterfall", async () => {
    let resolveRaw: (value: unknown) => void = () => {};
    mocks.queryRaw.mockReturnValue(
      new Promise((resolve) => {
        resolveRaw = resolve;
      }),
    );

    const pending = getUnreadCounts("viewer-2");
    // The three counts must already have been dispatched while the raw query
    // is still outstanding; a sequential implementation would have issued one.
    await Promise.resolve();
    expect(queries.length).toBeGreaterThan(1);

    resolveRaw([{ count: 0 }]);
    await pending;
  });
});
