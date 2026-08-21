/**
 * Feed-shaped placeholder.
 *
 * Mirrors `FeedPostCard`'s geometry - avatar, two metadata lines, title,
 * summary, 16:8 media box, action row - so the transition to real content does
 * not move anything. A generic spinner would give no such guarantee, and a
 * full-page spinner would blank the app shell that Batch 1 keeps mounted.
 */
export function FeedPostSkeleton() {
  return (
    <div
      aria-hidden
      className="overflow-hidden rounded-[22px] border border-[color:var(--px-border)] bg-[color:var(--px-surface)] shadow-sm"
      data-testid="feed-post-skeleton"
    >
      <div className="flex items-start justify-between gap-3 px-4 pb-3 pt-4 sm:px-5 sm:pt-5">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="h-11 w-11 shrink-0 animate-pulse rounded-full bg-[color:var(--px-muted)] motion-reduce:animate-none" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-3.5 w-1/3 animate-pulse rounded bg-[color:var(--px-muted)] motion-reduce:animate-none" />
            <div className="h-3 w-1/4 animate-pulse rounded bg-[color:var(--px-muted)] motion-reduce:animate-none" />
          </div>
        </div>
        <div className="h-6 w-16 shrink-0 animate-pulse rounded-full bg-[color:var(--px-muted)] motion-reduce:animate-none" />
      </div>

      <div className="space-y-2 px-4 pb-4 sm:px-5">
        <div className="h-5 w-3/4 animate-pulse rounded bg-[color:var(--px-muted)] motion-reduce:animate-none" />
        <div className="h-3.5 w-full animate-pulse rounded bg-[color:var(--px-muted)] motion-reduce:animate-none" />
        <div className="h-3.5 w-5/6 animate-pulse rounded bg-[color:var(--px-muted)] motion-reduce:animate-none" />
      </div>

      {/* Same aspect ratio as a real card's media, so no shift on swap. */}
      <div className="aspect-[16/8] w-full animate-pulse bg-[color:var(--px-muted)] motion-reduce:animate-none" />

      <div className="flex items-center justify-between gap-3 px-4 py-4 sm:px-5">
        <div className="h-9 w-24 animate-pulse rounded-xl bg-[color:var(--px-muted)] motion-reduce:animate-none" />
        <div className="h-9 w-28 animate-pulse rounded-xl bg-[color:var(--px-muted)] motion-reduce:animate-none" />
      </div>
    </div>
  );
}

/** Initial-load placeholder: several cards, so the feed reads as a feed. */
export function FeedSkeletonList({ count = 3 }: { count?: number }) {
  return (
    <div className="grid gap-4" data-testid="feed-skeleton-list">
      <p aria-live="polite" className="sr-only">
        Loading your feed
      </p>
      {Array.from({ length: count }, (_, index) => (
        <FeedPostSkeleton key={index} />
      ))}
    </div>
  );
}
