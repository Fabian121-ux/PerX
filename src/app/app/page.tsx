import { Suspense } from "react";
import { redirect } from "next/navigation";

import { FeedSkeletonList } from "@/components/feed/feed-post-skeleton";
import { HomeFeedView } from "@/components/feed/home-feed-view";
import { HomeFeedSection } from "@/components/feed/home-feed-section";
import { getCurrentUser } from "@/lib/auth/session";
import { getUnreadCounts } from "@/lib/data/unread-counts";
import { hasCapability } from "@/lib/permissions/capabilities";

export const dynamic = "force-dynamic";

/**
 * Authenticated Home - the primary social surface.
 *
 * Home is post-first: the feed is the main column, and the personal activity
 * that used to dominate this page now lives in Profile (Batch 1) or the rail.
 *
 * Only what Home renders is fetched. The deal, proposal and draft counts were
 * removed along with the metric grid rather than left querying for a surface
 * that no longer displays them.
 *
 * The feed streams behind a Suspense boundary declared *here*, inside the page,
 * rather than as `src/app/app/loading.tsx`. A segment-level `loading.tsx` would
 * sit above every nested authenticated route and flush the response before
 * their `notFound()` gates run, which is the 404-correctness regression Batch 1
 * removed. Scoping the boundary to the feed keeps those statuses intact while
 * still showing feed-shaped skeletons.
 */
export default async function HomePage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/sign-in");
  }

  // Cheap, and needed for the rail that renders immediately around the feed.
  const unreadCounts = await getUnreadCounts(user.id);

  return (
    <HomeFeedView
      canCreate={hasCapability(user.roles, "opportunity:create")}
      connectionRequestsCount={unreadCounts.pendingConnectionRequests}
      feed={
        <Suspense fallback={<FeedSkeletonList />}>
          <HomeFeedSection userId={user.id} />
        </Suspense>
      }
      profileCompleteness={user.profile?.profileCompleteness ?? 0}
      unreadConversationsCount={unreadCounts.unreadConversations}
      user={{
        avatarUrl: user.profile?.profileImageUrl ?? user.imageUrl ?? null,
        id: user.id,
        name: user.name,
      }}
    />
  );
}
