import { isSigningOut } from "@/lib/auth/client-session-cleanup";
import type { HomeFeedPost } from "@/lib/data/home-feed-view";
import type { HomeFeedSegment } from "@/lib/data/home-feed";

/**
 * Home feed session cache.
 *
 * Navigating Home -> Profile -> Home unmounts the feed, so without this the
 * viewer would lose every appended page and land back at post #1. Restoring
 * from `sessionStorage` makes the return trip instant and keeps the scroll
 * position meaningful, because the content it referred to still exists.
 *
 * `sessionStorage` is deliberate rather than a client state library:
 * - it survives unmount and back/forward navigation
 * - it is per-tab, so two tabs cannot fight over one feed
 * - it dies with the tab, so a stale feed is never resurrected days later
 *
 * The repo has no TanStack Query/SWR/Zustand, and adding one for a single
 * cached list would be a large dependency for a small, well-bounded need.
 */

const CACHE_KEY = "perx:home-feed:v1";
/** Beyond this the cache is considered stale and a fresh first page is fetched. */
const MAX_AGE_MS = 5 * 60 * 1000;
/**
 * Cap on restored posts. Restoring an unbounded feed would mean parsing a
 * multi-megabyte JSON blob and mounting hundreds of cards on a route
 * transition, which is slower than just refetching one page.
 */
const MAX_CACHED_POSTS = 90;

export type CachedFeed = {
  nextCursor: string | null;
  nextSegment: HomeFeedSegment | null;
  posts: HomeFeedPost[];
  savedAt: number;
  scrollTop: number;
  /** Scopes the cache to one account so a sign-out/sign-in cannot leak a feed. */
  userId: string;
};

function isPost(value: unknown): value is HomeFeedPost {
  if (!value || typeof value !== "object") return false;
  const post = value as Partial<HomeFeedPost>;
  return typeof post.id === "string" && typeof post.title === "string";
}

/**
 * Whether this page view is an explicit user refresh (F5, pull-to-refresh, or
 * address-bar reload) rather than a client-side navigation back to Home.
 *
 * Caching must not defeat a deliberate refresh: when someone reloads because
 * the feed looked stale, restoring the very feed they were trying to replace is
 * the wrong answer. Soft navigations do not produce a `reload` entry, so the
 * cache still applies to Home -> Profile -> Back.
 */
export function isExplicitReload(): boolean {
  if (typeof window === "undefined" || !window.performance?.getEntriesByType) {
    return false;
  }

  try {
    const [entry] = window.performance.getEntriesByType("navigation");
    return (
      (entry as PerformanceNavigationTiming | undefined)?.type === "reload"
    );
  } catch {
    return false;
  }
}

export function readFeedCache(userId: string): CachedFeed | null {
  if (typeof window === "undefined") return null;
  // The server-rendered first page is already fresh on a reload; keeping the
  // cached tail would just re-append stale pages beneath it.
  if (isExplicitReload()) {
    clearFeedCache();
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<CachedFeed>;
    if (
      parsed.userId !== userId ||
      typeof parsed.savedAt !== "number" ||
      !Array.isArray(parsed.posts)
    ) {
      return null;
    }
    // A clock moving backwards, or an expired entry: treat as absent.
    const age = Date.now() - parsed.savedAt;
    if (age < 0 || age > MAX_AGE_MS) return null;

    const posts = parsed.posts.filter(isPost);
    if (!posts.length) return null;

    return {
      nextCursor:
        typeof parsed.nextCursor === "string" ? parsed.nextCursor : null,
      nextSegment:
        parsed.nextSegment === "network" || parsed.nextSegment === "discovery"
          ? parsed.nextSegment
          : null,
      posts,
      savedAt: parsed.savedAt,
      scrollTop: typeof parsed.scrollTop === "number" ? parsed.scrollTop : 0,
      userId,
    };
  } catch {
    return null;
  }
}

export function writeFeedCache(entry: Omit<CachedFeed, "savedAt">) {
  // Signing out purges this cache; without this guard the home feed's unmount
  // persist would immediately rewrite the previous account's private feed as
  // the router navigates to the sign-in page.
  if (isSigningOut()) return;
  if (typeof window === "undefined") return;

  try {
    // Keeping the head rather than the tail preserves the newest posts and the
    // scroll position that the viewer actually returns to.
    const posts = entry.posts.slice(0, MAX_CACHED_POSTS);
    // Truncating the list invalidates the cursor, because the dropped tail
    // would be skipped entirely on the next page request.
    const truncated = posts.length < entry.posts.length;

    window.sessionStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        ...entry,
        nextCursor: truncated ? null : entry.nextCursor,
        nextSegment: truncated ? null : entry.nextSegment,
        posts,
        savedAt: Date.now(),
      }),
    );
  } catch {
    // Quota exceeded or storage disabled: the feed still works, it just
    // refetches on return.
  }
}

export function clearFeedCache() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(CACHE_KEY);
  } catch {
    // Nothing to do.
  }
}
