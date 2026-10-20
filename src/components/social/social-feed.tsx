import { getSocialFeedResult } from "@/lib/data/social-posts";
import { SocialFeedStream } from "@/components/social/social-feed-stream";

export async function SocialFeed({ viewerId }: { viewerId?: string }) {
  const feed = await getSocialFeedResult(viewerId);
  return (
    <section aria-label="Community posts" className="grid min-w-0 gap-4">
      {feed.unavailable ? (
        <p className="rounded-xl bg-[color:var(--px-surface-soft)] p-4 text-sm text-[color:var(--px-text)]" role="status">
          Community posts are temporarily unavailable.
        </p>
      ) : feed.items.length ? (
        <SocialFeedStream initialItems={feed.items} initialNextCursor={feed.nextCursor} viewerId={viewerId} />
      ) : (
        <p className="rounded-xl border border-[color:var(--px-border)] p-5 text-sm text-[color:var(--px-text-muted)]">
          No community updates yet. You can be the first to share one.
        </p>
      )}
    </section>
  );
}
