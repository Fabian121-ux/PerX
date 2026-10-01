import Link from "next/link";
import { notFound, unstable_rethrow } from "next/navigation";
import { PublicPageShell } from "@/components/standard-page";
import { getCurrentUser } from "@/lib/auth/session";
import { getSocialFeed } from "@/lib/data/social-posts";
import { SocialPostCard } from "@/components/social/social-post-card";
import { logServerDataError } from "@/lib/logging/runtime";
export const dynamic = "force-dynamic";
export default async function PostsPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  const user = await getCurrentUser();
  const { cursor } = await searchParams;
  let feed;
  try {
    feed = await getSocialFeed(user?.id, cursor);
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof Error && error.message.startsWith("Invalid cursor"))
      notFound();
    logServerDataError({
      error,
      operation: "social feed page",
      route: "/posts",
    });
  }
  return (
    <PublicPageShell>
      <main className="mx-auto grid min-w-0 max-w-[640px] gap-4 px-2 py-4 sm:px-4">
        <h1 className="text-xl font-bold">Community posts</h1>
        {!feed ? (
          <p>Community posts are temporarily unavailable.</p>
        ) : feed.items.length ? (
          feed.items.map((post) => <SocialPostCard key={post.id} post={post} />)
        ) : (
          <p>No public posts yet.</p>
        )}
        {feed?.nextCursor && (
          <Link href={`/posts?cursor=${encodeURIComponent(feed.nextCursor)}`}>
            More posts
          </Link>
        )}
      </main>
    </PublicPageShell>
  );
}
