import { HomeFeed } from "@/components/feed/home-feed";
import { getHomeFeedPageResult } from "@/lib/data/home-feed";
import {
  getSavedOpportunityIds,
  toHomeFeedPost,
} from "@/lib/data/home-feed-view";
import { getPrisma } from "@/lib/db/prisma";

/**
 * Server half of the feed.
 *
 * Split out of the page so the Suspense boundary wraps only the feed query.
 * Home's shell, composer entry and rail render immediately while this streams,
 * which is what keeps the app shell from blanking on first load.
 */
export async function HomeFeedSection({ userId }: { userId: string }) {
  const feedPage = await getHomeFeedPageResult({ viewerId: userId });

  // Depends on the feed's ids, so it cannot be parallelised with the query
  // above. One batched lookup for the page, not one per card.
  const savedIds = await getSavedOpportunityIds(
    getPrisma().opportunityBookmark,
    userId,
    feedPage.items.map((item) => item.id),
  );

  return (
    <HomeFeed
      initialNextCursor={feedPage.nextCursor}
      initialNextSegment={feedPage.nextSegment}
      initialPosts={feedPage.items.map((item) =>
        toHomeFeedPost(item, { savedIds }),
      )}
      unavailable={feedPage.unavailable}
      userId={userId}
    />
  );
}
