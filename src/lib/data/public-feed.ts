import { unstable_rethrow } from "next/navigation";

import { getPublicOpportunityPage } from "@/lib/data/public-opportunities";
import {
  toPublicFeedPost,
  type PublicFeedPost,
} from "@/lib/data/home-feed-view";
import { logServerDataError } from "@/lib/logging/runtime";

/** Anonymous, bounded discovery. Never reads sessions, bookmarks or networks. */
export async function getPublicFeedResult(): Promise<{
  posts: PublicFeedPost[];
  unavailable: boolean;
}> {
  try {
    const page = await getPublicOpportunityPage({ pageSize: 12 });
    return { posts: page.items.map(toPublicFeedPost), unavailable: false };
  } catch (error) {
    unstable_rethrow(error);
    logServerDataError({ error, operation: "public landing feed", route: "/" });
    return { posts: [], unavailable: true };
  }
}
