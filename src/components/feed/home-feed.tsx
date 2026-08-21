"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { FeedPostCard } from "@/components/feed/feed-post-card";
import { FeedPostSkeleton } from "@/components/feed/feed-post-skeleton";
import type { HomeFeedSegment } from "@/lib/data/home-feed";
import type { HomeFeedPost } from "@/lib/data/home-feed-view";
import { readFeedCache, writeFeedCache } from "@/lib/feed/feed-cache";
import { markImpression, recordFeedEvent } from "@/lib/feed/events";

/**
 * Explicit feed lifecycle.
 *
 * A single `loading` boolean cannot distinguish "first paint" from "appending
 * page 4", and those need opposite UI: one shows skeletons, the other must keep
 * every existing post on screen. `error` is likewise page-scoped - a failed
 * page 3 does not invalidate pages 1 and 2.
 */
type FeedStatus = "idle" | "loading-more" | "error" | "end";

/** Distance from the bottom at which the next page starts loading. */
const PREFETCH_MARGIN_PX = 800;

export function HomeFeed({
  initialNextCursor,
  initialNextSegment,
  initialPosts,
  unavailable = false,
  userId,
}: {
  initialNextCursor: string | null;
  initialNextSegment: HomeFeedSegment | null;
  initialPosts: HomeFeedPost[];
  unavailable?: boolean;
  userId: string;
}) {
  const [posts, setPosts] = useState<HomeFeedPost[]>(initialPosts);
  const [cursor, setCursor] = useState(initialNextCursor);
  const [segment, setSegment] = useState(initialNextSegment);
  const [status, setStatus] = useState<FeedStatus>(
    initialNextCursor || initialNextSegment ? "idle" : "end",
  );
  const [restored, setRestored] = useState(false);

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  /**
   * Guards against the sentinel firing repeatedly while one request is already
   * in flight. State cannot be used here: the observer callback closes over a
   * stale render, so a ref is the only value it can read synchronously.
   */
  const inFlightRef = useRef(false);
  /**
   * Monotonic request id. A response whose id is no longer current is
   * discarded, so a slow page cannot overwrite a newer refresh or reset.
   */
  const requestIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const seenImpressionsRef = useRef(new Set<string>());
  /** Latest values for the unmount-time cache write, without re-subscribing. */
  const snapshotRef = useRef({ cursor, posts, segment });

  // Written in an effect, not during render: React may render without
  // committing, and a discarded render must not be what gets cached.
  useEffect(() => {
    snapshotRef.current = { cursor, posts, segment };
  }, [cursor, posts, segment]);

  /**
   * Restore a cached feed on return navigation.
   *
   * Runs once after mount so the server-rendered first page paints immediately;
   * the cache then extends it with the pages the viewer had already loaded.
   * Guarded by a ref rather than a dependency list because it must happen
   * exactly once per mount even though `posts` changes constantly afterwards.
   */
  const restoreRef = useRef(false);
  useEffect(() => {
    if (unavailable || restoreRef.current) return;
    restoreRef.current = true;

    /*
      Deferred to a microtask, matching how the Create Post composer restores
      its browser draft. Reading `sessionStorage` and swapping the list
      synchronously inside the effect would cascade a second render before the
      server-rendered feed had painted, so the first frame is allowed to commit
      first.
    */
    window.queueMicrotask(() => {
      const cached = readFeedCache(userId);
      if (!cached || cached.posts.length <= initialPosts.length) {
        setRestored(true);
        return;
      }

      // The server's first page is authoritative for freshness (it may contain
      // posts published since the cache was written), so it leads; cached posts
      // only extend the tail.
      setPosts((current) => mergePosts(current, cached.posts));
      setCursor(cached.nextCursor);
      setSegment(cached.nextSegment);
      setStatus(cached.nextCursor || cached.nextSegment ? "idle" : "end");
      setRestored(true);

      const main = document.querySelector<HTMLElement>(".dashboard-main");
      if (main && cached.scrollTop > 0) {
        // Two frames: the first lets React commit the restored posts, the
        // second runs after layout, when the scroll height can actually
        // accommodate the saved offset.
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            main.scrollTop = cached.scrollTop;
          });
        });
      }
    });
  }, [initialPosts, unavailable, userId]);

  /** Persist on unmount so Home -> Profile -> Back returns to the same feed. */
  useEffect(() => {
    if (unavailable) return;

    const persist = () => {
      const main = document.querySelector<HTMLElement>(".dashboard-main");
      const snapshot = snapshotRef.current;
      if (!snapshot.posts.length) return;
      writeFeedCache({
        nextCursor: snapshot.cursor,
        nextSegment: snapshot.segment,
        posts: snapshot.posts,
        scrollTop: main?.scrollTop ?? 0,
        userId,
      });
    };

    window.addEventListener("pagehide", persist);
    return () => {
      persist();
      window.removeEventListener("pagehide", persist);
    };
  }, [unavailable, userId]);

  const loadMore = useCallback(
    async (requestedCursor: string | null, requestedSegment: HomeFeedSegment | null) => {
      if (inFlightRef.current) return;
      if (!requestedCursor && !requestedSegment) return;

      inFlightRef.current = true;
      const requestId = ++requestIdRef.current;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setStatus("loading-more");

      try {
        const params = new URLSearchParams();
        if (requestedCursor) params.set("cursor", requestedCursor);
        if (requestedSegment) params.set("segment", requestedSegment);

        const response = await fetch(`/api/home-feed?${params.toString()}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Feed request failed.");

        const payload = (await response.json()) as {
          items?: unknown;
          nextCursor?: unknown;
          nextSegment?: unknown;
        };
        if (!Array.isArray(payload.items)) {
          throw new Error("Malformed feed response.");
        }
        // A newer request superseded this one while it was in flight.
        if (requestId !== requestIdRef.current) return;

        const incoming = payload.items as HomeFeedPost[];
        const nextCursor =
          typeof payload.nextCursor === "string" ? payload.nextCursor : null;
        const nextSegment =
          payload.nextSegment === "network" || payload.nextSegment === "discovery"
            ? payload.nextSegment
            : null;

        setPosts((current) => mergePosts(current, incoming));
        setCursor(nextCursor);
        setSegment(nextSegment);
        // No continuation of any kind means the stream is genuinely finished,
        // which stops the observer from ever requesting again.
        setStatus(nextCursor || nextSegment ? "idle" : "end");
      } catch {
        if (controller.signal.aborted) return;
        if (requestId !== requestIdRef.current) return;
        // Existing posts are untouched: only the tail reports failure.
        setStatus("error");
      } finally {
        if (requestId === requestIdRef.current) inFlightRef.current = false;
      }
    },
    [],
  );

  /**
   * Automatic loading as the sentinel approaches the viewport.
   *
   * The scroll container is `.dashboard-main` (it owns `overflow-y-auto`), not
   * the document, so it must be the observer root - against the default
   * viewport root the sentinel would never intersect.
   */
  useEffect(() => {
    if (unavailable || status === "end" || status === "error") return;
    if (!cursor && !segment) return;

    const sentinel = sentinelRef.current;
    if (!sentinel || typeof IntersectionObserver === "undefined") return;

    const root = document.querySelector<HTMLElement>(".dashboard-main");
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          void loadMore(cursor, segment);
        }
      },
      { root: root ?? null, rootMargin: `0px 0px ${PREFETCH_MARGIN_PX}px 0px` },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [cursor, loadMore, segment, status, unavailable]);

  /** Abort any in-flight request on unmount so it cannot set state afterwards. */
  useEffect(() => () => abortRef.current?.abort(), []);

  const onPostVisible = useCallback(
    (post: HomeFeedPost, position: number) => {
      if (!markImpression(seenImpressionsRef.current, post.id)) return;
      recordFeedEvent({ name: "post_impression", position, postId: post.id });
    },
    [],
  );

  if (unavailable) {
    return (
      <section aria-labelledby="home-feed-heading" className="grid gap-4">
        <h2 className="sr-only" id="home-feed-heading">
          Your feed
        </h2>
        <div
          className="rounded-[var(--px-radius)] border border-amber-300 bg-amber-50 p-6 text-sm leading-6 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100"
          role="alert"
        >
          <p className="font-black">Your feed is unavailable.</p>
          <p className="mt-1">
            No substitute content is being shown. Refresh this page to try
            again.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby="home-feed-heading" className="grid gap-4">
      <h2 className="sr-only" id="home-feed-heading">
        Your feed
      </h2>

      {posts.length ? (
        <div className="grid gap-4" data-testid="home-feed-list">
          {posts.map((post, index) => (
            <FeedPostCard
              key={post.id}
              onVisible={onPostVisible}
              position={index}
              post={post}
            />
          ))}
        </div>
      ) : (
        <FeedEmptyState />
      )}

      {/*
        The sentinel is rendered whenever a continuation exists, including while
        a request is in flight, so the observer stays attached and does not need
        to be torn down and rebuilt between pages.
      */}
      {posts.length && (cursor || segment) && status !== "end" ? (
        <div aria-hidden data-testid="feed-sentinel" ref={sentinelRef} />
      ) : null}

      <FeedTail
        onRetry={() => {
          // Retry re-requests the same cursor. Because merging is id-keyed, a
          // page that partially succeeded cannot produce duplicates.
          inFlightRef.current = false;
          void loadMore(cursor, segment);
        }}
        restored={restored}
        status={status}
        visiblePosts={posts.length}
      />
    </section>
  );
}

function FeedTail({
  onRetry,
  restored,
  status,
  visiblePosts,
}: {
  onRetry: () => void;
  restored: boolean;
  status: FeedStatus;
  visiblePosts: number;
}) {
  if (status === "loading-more") {
    return (
      <div className="grid gap-4" data-testid="feed-loading-more">
        <p aria-live="polite" className="sr-only">
          Loading more posts
        </p>
        <FeedPostSkeleton />
      </div>
    );
  }

  if (status === "error") {
    return (
      <div
        className="flex flex-col items-center gap-3 rounded-[var(--px-radius)] border border-[color:var(--px-border)] bg-[color:var(--px-surface)] p-6 text-center"
        data-testid="feed-error"
        role="alert"
      >
        <p className="text-sm font-bold text-[color:var(--px-text)]">
          Couldn&rsquo;t load more posts.
        </p>
        <p className="text-sm text-[color:var(--px-text-muted)]">
          The posts above are still available.
        </p>
        <button
          className="inline-flex min-h-11 items-center rounded-[var(--px-radius-sm)] bg-[color:var(--px-primary)] px-4 text-sm font-bold text-white transition hover:bg-[color:var(--px-primary-strong)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)]"
          onClick={onRetry}
          type="button"
        >
          Retry
        </button>
      </div>
    );
  }

  // Only claim the end of the feed once there is a feed to be at the end of,
  // and only after restoration has settled, so a cached continuation is not
  // contradicted for a frame.
  if (status === "end" && visiblePosts > 0 && restored) {
    return (
      <p
        className="py-6 text-center text-sm text-[color:var(--px-text-muted)]"
        data-testid="feed-end"
      >
        You&rsquo;re all caught up.
      </p>
    );
  }

  return null;
}

function FeedEmptyState() {
  return (
    <div
      className="rounded-[var(--px-radius)] border border-dashed border-[color:var(--px-border-strong)] bg-[color:var(--px-surface)] p-8 text-center"
      data-testid="feed-empty"
    >
      <h3 className="font-black text-[color:var(--px-text)]">
        Your feed is quiet.
      </h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[color:var(--px-text-muted)]">
        Connect with founders and explore the ecosystem, and posts will start
        appearing here.
      </p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        <EmptyStateLink href="/app/people" primary>
          Discover people
        </EmptyStateLink>
        <EmptyStateLink href="/app/discover">
          Explore the ecosystem
        </EmptyStateLink>
        <EmptyStateLink href="/app/opportunities/new">
          Create a post
        </EmptyStateLink>
      </div>
    </div>
  );
}

function EmptyStateLink({
  children,
  href,
  primary = false,
}: {
  children: React.ReactNode;
  href: string;
  primary?: boolean;
}) {
  return (
    <a
      className={`inline-flex min-h-11 items-center rounded-[var(--px-radius-sm)] px-4 text-sm font-bold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)] ${
        primary
          ? "bg-[color:var(--px-primary)] text-white hover:bg-[color:var(--px-primary-strong)]"
          : "border border-[color:var(--px-border)] bg-[color:var(--px-surface)] text-[color:var(--px-text)] hover:border-[color:var(--px-primary)]"
      }`}
      href={href}
    >
      {children}
    </a>
  );
}

/**
 * Append while preserving order and rejecting anything already present.
 *
 * Duplicates are otherwise easy to produce: a retry that re-requests a
 * partially applied page, a post published between two page requests shifting
 * the keyset window, or a cache restore overlapping the server's first page.
 * Keying on the post id makes all three cases idempotent.
 */
export function mergePosts(
  current: readonly HomeFeedPost[],
  incoming: readonly HomeFeedPost[],
): HomeFeedPost[] {
  if (!incoming.length) return [...current];

  const seen = new Set(current.map((post) => post.id));
  const merged = [...current];
  for (const post of incoming) {
    if (seen.has(post.id)) continue;
    seen.add(post.id);
    merged.push(post);
  }
  return merged;
}
