import Link from "next/link";
import { getSocialFeedResult } from "@/lib/data/social-posts";
import { SocialPostCard } from "./social-post-card";
export async function SocialFeed({ viewerId }: { viewerId?: string }) {
  const feed = await getSocialFeedResult(viewerId);
  return (
    <section aria-label="Community posts" className="grid min-w-0 gap-4">
      {!feed.unavailable && feed.items.length > 0 ? (
        <div className="flex items-center justify-between gap-2 px-1">
          <h2 className="text-base font-black text-[color:var(--px-text)]">Community updates</h2>
          <Link className="text-xs font-bold text-[color:var(--px-primary)]" href="/posts">View all</Link>
        </div>
      ) : null}
      {feed.unavailable ? (
        <p role="status">Community posts are temporarily unavailable.</p>
      ) : (
        feed.items.map((post) => <SocialPostCard key={post.id} post={post} />)
      )}
      {feed.nextCursor && (
        <Link
          className="py-3 text-center font-semibold"
          href={`/posts?cursor=${encodeURIComponent(feed.nextCursor)}`}
        >
          More community posts
        </Link>
      )}
    </section>
  );
}
