// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  setBookmark: vi.fn(),
}));

vi.mock("@/features/opportunities/actions", () => ({
  setOpportunityBookmarkAction: mocks.setBookmark,
}));
vi.mock("next/navigation", () => ({ usePathname: () => "/app" }));
vi.mock("next/link", async () => {
  const React = await import("react");
  return {
    default: ({
      children,
      href,
      ...props
    }: {
      children: React.ReactNode;
      href: string;
      [key: string]: unknown;
    }) => React.createElement("a", { ...props, href }, children),
  };
});
vi.mock("next/image", async () => {
  const React = await import("react");
  return {
    default: (props: Record<string, unknown>) => {
      // `fill`/`priority` are Next-specific and invalid on a bare <img>.
      const { alt, fill, priority, sizes, src, ...rest } = props;
      void fill;
      void priority;
      void sizes;
      return React.createElement("img", { alt, src, ...rest });
    },
  };
});

import { HomeFeed } from "@/components/feed/home-feed";
import type { HomeFeedPost } from "@/lib/data/home-feed-view";
import { FeedbackProvider } from "@/components/ui/feedback-provider";

/** Observer instances created during a test, so tests can fire intersections. */
let observers: Array<{
  callback: IntersectionObserverCallback;
  elements: Set<Element>;
}> = [];

function post(id: string, overrides: Partial<HomeFeedPost> = {}): HomeFeedPost {
  return {
    authorAvatarUrl: null,
    authorId: `author-${id}`,
    authorName: `Author ${id}`,
    authorUsername: `author${id}`,
    budgetMaxMinor: null,
    budgetMinMinor: null,
    currency: "NGN",
    id,
    imageAlt: "",
    imageUrl: null,
    location: null,
    publishedAt: new Date("2026-08-01T12:00:00.000Z").toISOString(),
    remote: true,
    slug: `slug-${id}`,
    summary: `Summary ${id}`,
    title: `Post ${id}`,
    trust: {
      calculationVersion: "test",
      description: "Baseline",
      evidence: [],
      evidenceCount: 0,
      label: "New member",
      level: "NEW",
      score: null,
      shortLabel: "New",
    },
    type: "JOB",
    viewerHasSaved: false,
    ...overrides,
  };
}

function renderFeed(props: Partial<Parameters<typeof HomeFeed>[0]> = {}) {
  return render(
    <FeedbackProvider>
      <HomeFeed
        initialNextCursor="cursor-1"
        initialNextSegment="network"
        initialPosts={[post("p1"), post("p2")]}
        userId="viewer-1"
        {...props}
      />
    </FeedbackProvider>,
  );
}

/** Simulate the sentinel scrolling into view. */
async function triggerSentinel() {
  await act(async () => {
    observers.forEach((observer) => {
      observer.callback(
        [...observer.elements].map(
          (target) => ({ isIntersecting: true, target }) as IntersectionObserverEntry,
        ),
        {} as IntersectionObserver,
      );
    });
  });
}

function jsonResponse(body: unknown, ok = true) {
  return { json: async () => body, ok, status: ok ? 200 : 500 };
}

describe("home feed client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    observers = [];
    window.sessionStorage.clear();

    class MockIntersectionObserver {
      callback: IntersectionObserverCallback;
      elements = new Set<Element>();
      constructor(callback: IntersectionObserverCallback) {
        this.callback = callback;
        observers.push(this);
      }
      observe(element: Element) {
        this.elements.add(element);
      }
      disconnect() {
        this.elements.clear();
        observers = observers.filter((o) => o !== this);
      }
      unobserve(element: Element) {
        this.elements.delete(element);
      }
      takeRecords() {
        return [];
      }
    }
    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
    /*
      A soft navigation, so the reload-bypass path stays inactive by default.

      Only `getEntriesByType` is replaced. Spreading `window.performance` into a
      plain object drops its prototype methods - including `performance.now`,
      which jsdom's own timer implementation calls - and produced "performance.now
      is not a function" from a timer firing after the test finished.
    */
    vi.spyOn(window.performance, "getEntriesByType").mockReturnValue([
      { type: "navigate" } as unknown as PerformanceEntry,
    ]);
    mocks.setBookmark.mockResolvedValue({ success: true });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    cleanup();
  });

  it("renders the initial server-provided posts", async () => {
    const view = renderFeed();
    // Cache restoration runs in a microtask after mount.
    await act(async () => {});

    expect(view.getByText("Post p1")).toBeTruthy();
    expect(view.getByText("Post p2")).toBeTruthy();
    expect(view.container.querySelectorAll("[data-post-id]")).toHaveLength(2);
  });

  it("loads the next page when the sentinel enters the viewport", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({ items: [post("p3")], nextCursor: null, nextSegment: null }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const view = renderFeed();
    await triggerSentinel();

    await waitFor(() => expect(view.getByText("Post p3")).toBeTruthy());
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain("cursor=cursor-1");
  });

  it("keeps existing posts visible while the next page loads", async () => {
    let release: (value: unknown) => void = () => {};
    const pending = new Promise((resolve) => {
      release = resolve;
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockReturnValue(
        pending.then(() =>
          jsonResponse({ items: [post("p3")], nextCursor: null, nextSegment: null }),
        ),
      ),
    );

    const view = renderFeed();
    await triggerSentinel();

    // Mid-flight: the already-loaded posts must not be replaced by a spinner.
    expect(view.getByText("Post p1")).toBeTruthy();
    expect(view.getByText("Post p2")).toBeTruthy();
    expect(view.queryByTestId("feed-loading-more")).toBeTruthy();

    await act(async () => {
      release(null);
      await pending;
    });
    await waitFor(() => expect(view.getByText("Post p3")).toBeTruthy());
  });

  it("does not render a post twice when a page repeats ids", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          // p2 is already on screen; only p3 is genuinely new.
          items: [post("p2"), post("p3")],
          nextCursor: null,
          nextSegment: null,
        }),
      ),
    );

    const view = renderFeed();
    await triggerSentinel();

    await waitFor(() => expect(view.getByText("Post p3")).toBeTruthy());
    expect(view.container.querySelectorAll('[data-post-id="p2"]')).toHaveLength(1);
    expect(view.container.querySelectorAll("[data-post-id]")).toHaveLength(3);
  });

  it("preserves loaded posts when an incremental page fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    const view = renderFeed();
    await triggerSentinel();

    await waitFor(() => expect(view.getByTestId("feed-error")).toBeTruthy());
    // Failure is confined to the tail.
    expect(view.getByText("Post p1")).toBeTruthy();
    expect(view.getByText("Post p2")).toBeTruthy();
  });

  it("recovers the failed cursor on retry without duplicating posts", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(
        jsonResponse({ items: [post("p3")], nextCursor: null, nextSegment: null }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const view = renderFeed();
    await triggerSentinel();
    await waitFor(() => expect(view.getByTestId("feed-error")).toBeTruthy());

    await act(async () => {
      fireEvent.click(view.getByRole("button", { name: "Retry" }));
    });

    await waitFor(() => expect(view.getByText("Post p3")).toBeTruthy());
    // The same cursor is re-requested, not a different one.
    expect(String(fetchMock.mock.calls[1][0])).toContain("cursor=cursor-1");
    expect(view.container.querySelectorAll("[data-post-id]")).toHaveLength(3);
  });

  it("stops requesting once the feed reports no continuation", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({ items: [post("p3")], nextCursor: null, nextSegment: null }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const view = renderFeed();
    await triggerSentinel();
    await waitFor(() => expect(view.getByText("Post p3")).toBeTruthy());

    // Further intersections must not produce more requests.
    await triggerSentinel();
    await triggerSentinel();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(view.getByTestId("feed-end")).toBeTruthy());
    expect(view.queryByTestId("feed-sentinel")).toBeNull();
  });

  it("does not issue overlapping requests while one is in flight", async () => {
    let release: (value: unknown) => void = () => {};
    const pending = new Promise((resolve) => {
      release = resolve;
    });
    const fetchMock = vi
      .fn()
      .mockReturnValue(
        pending.then(() =>
          jsonResponse({ items: [post("p3")], nextCursor: null, nextSegment: null }),
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    renderFeed();
    await triggerSentinel();
    await triggerSentinel();
    await triggerSentinel();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    await act(async () => {
      release(null);
      await pending;
    });
  });

  it("continues into the discovery segment when the network is exhausted", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({ items: [post("p3")], nextCursor: null, nextSegment: null }),
      );
    vi.stubGlobal("fetch", fetchMock);

    renderFeed({ initialNextCursor: null, initialNextSegment: "discovery" });
    await triggerSentinel();

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain("segment=discovery");
    expect(url).not.toContain("cursor=");
  });

  it("shows an actionable empty state rather than a blank screen", async () => {
    const view = renderFeed({
      initialNextCursor: null,
      initialNextSegment: null,
      initialPosts: [],
    });
    await act(async () => {});

    expect(view.getByTestId("feed-empty")).toBeTruthy();
    expect(view.getByText("Discover people")).toBeTruthy();
    expect(view.getByText("Create a post")).toBeTruthy();
  });

  it("reports feed unavailability without pretending the feed is empty", () => {
    const view = renderFeed({ initialPosts: [], unavailable: true });

    const alert = view.getByRole("alert");
    expect(alert.textContent).toContain("Your feed is unavailable.");
    expect(view.queryByTestId("feed-empty")).toBeNull();
  });

  describe("session cache", () => {
    const CACHE_KEY = "perx:home-feed:v1";

    it("restores additional pages loaded before navigating away", async () => {
      window.sessionStorage.setItem(
        CACHE_KEY,
        JSON.stringify({
          nextCursor: null,
          nextSegment: null,
          posts: [post("p1"), post("p2"), post("cached-3")],
          savedAt: Date.now(),
          scrollTop: 0,
          userId: "viewer-1",
        }),
      );

      const view = renderFeed();

      await waitFor(() => expect(view.getByText("Post cached-3")).toBeTruthy());
      // Restoration extends the server page; it must not duplicate it.
      expect(view.container.querySelectorAll("[data-post-id]")).toHaveLength(3);
    });

    it("ignores a cache belonging to a different account", async () => {
      window.sessionStorage.setItem(
        CACHE_KEY,
        JSON.stringify({
          nextCursor: null,
          nextSegment: null,
          posts: [post("other-user-post")],
          savedAt: Date.now(),
          scrollTop: 0,
          userId: "someone-else",
        }),
      );

      const view = renderFeed();

      await act(async () => {});
      expect(view.queryByText("Post other-user-post")).toBeNull();
    });

    it("bypasses the cache on an explicit reload", async () => {
      vi.spyOn(window.performance, "getEntriesByType").mockReturnValue([
        { type: "reload" } as unknown as PerformanceEntry,
      ]);
      window.sessionStorage.setItem(
        CACHE_KEY,
        JSON.stringify({
          nextCursor: null,
          nextSegment: null,
          posts: [post("p1"), post("stale-cached")],
          savedAt: Date.now(),
          scrollTop: 0,
          userId: "viewer-1",
        }),
      );

      const view = renderFeed();

      await act(async () => {});
      // A deliberate refresh must show fresh server data, not the old feed.
      expect(view.queryByText("Post stale-cached")).toBeNull();
      expect(window.sessionStorage.getItem(CACHE_KEY)).toBeNull();
    });

    it("ignores an expired cache", async () => {
      window.sessionStorage.setItem(
        CACHE_KEY,
        JSON.stringify({
          nextCursor: null,
          nextSegment: null,
          posts: [post("p1"), post("ancient")],
          savedAt: Date.now() - 60 * 60 * 1000,
          scrollTop: 0,
          userId: "viewer-1",
        }),
      );

      const view = renderFeed();

      await act(async () => {});
      expect(view.queryByText("Post ancient")).toBeNull();
    });

    it("persists the feed and scroll position on unmount", async () => {
      const main = document.createElement("div");
      main.className = "dashboard-main";
      document.body.appendChild(main);
      Object.defineProperty(main, "scrollTop", { value: 420, writable: true });

      const view = renderFeed();
      await act(async () => {});
      view.unmount();

      const cached = JSON.parse(
        window.sessionStorage.getItem(CACHE_KEY) ?? "{}",
      );
      expect(cached.userId).toBe("viewer-1");
      expect(cached.scrollTop).toBe(420);
      expect(cached.posts.map((p: HomeFeedPost) => p.id)).toEqual(["p1", "p2"]);
      main.remove();
    });
  });
});
