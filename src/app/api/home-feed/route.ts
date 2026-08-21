import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { decodeCursor } from "@/lib/data/cursor";
import {
  clampHomeFeedPageSize,
  getHomeFeedPage,
  MAX_HOME_FEED_PAGE_SIZE,
  type HomeFeedSegment,
} from "@/lib/data/home-feed";
import {
  getSavedOpportunityIds,
  toHomeFeedPost,
} from "@/lib/data/home-feed-view";
import { getPrisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

const segments = new Set<HomeFeedSegment>(["discovery", "network"]);

function parseSegment(value: string | null): HomeFeedSegment | null {
  if (!value) return "network";
  return segments.has(value as HomeFeedSegment)
    ? (value as HomeFeedSegment)
    : null;
}

/**
 * Incremental Home feed pages.
 *
 * The first page is server-rendered with the route; this endpoint serves pages
 * 2..n for infinite scroll. Authorization is re-checked on every request - the
 * cursor is not a capability, and a session can be revoked between pages.
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 },
    );
  }

  const url = new URL(request.url);

  const segment = parseSegment(url.searchParams.get("segment"));
  if (!segment) {
    return NextResponse.json({ error: "Invalid segment." }, { status: 400 });
  }

  const rawCursor = url.searchParams.get("cursor");
  // Reject a malformed cursor before touching the database. Scope mismatch is
  // validated inside `getHomeFeedPage`, which knows the viewer.
  if (rawCursor && !decodeCursor(rawCursor)) {
    return NextResponse.json({ error: "Invalid cursor." }, { status: 400 });
  }

  const rawPageSize = url.searchParams.get("pageSize");
  let pageSize: number | undefined;
  if (rawPageSize !== null) {
    const requested = Number(rawPageSize);
    if (
      !Number.isInteger(requested) ||
      requested < 1 ||
      requested > MAX_HOME_FEED_PAGE_SIZE
    ) {
      return NextResponse.json(
        { error: `Page size must be between 1 and ${MAX_HOME_FEED_PAGE_SIZE}.` },
        { status: 400 },
      );
    }
    pageSize = clampHomeFeedPageSize(requested);
  }

  let page;
  try {
    page = await getHomeFeedPage({
      cursor: rawCursor ?? undefined,
      pageSize,
      segment,
      viewerId: user.id,
    });
  } catch (error) {
    // A replayed or cross-viewer cursor is a client error. Anything else is a
    // genuine failure and must surface as 500 so the client shows its retry
    // state rather than silently ending the feed.
    if (
      error instanceof Error &&
      (error.message === "Invalid cursor." ||
        error.message === "Invalid cursor scope.")
    ) {
      return NextResponse.json({ error: "Invalid cursor." }, { status: 400 });
    }
    throw error;
  }

  const savedIds = await getSavedOpportunityIds(
    getPrisma().opportunityBookmark,
    user.id,
    page.items.map((item) => item.id),
  );

  return NextResponse.json(
    {
      items: page.items.map((item) => toHomeFeedPost(item, { savedIds })),
      nextCursor: page.nextCursor,
      nextSegment: page.nextSegment,
      pageSize: page.pageSize,
      segment: page.segment,
    },
    // The feed is viewer-scoped and block-sensitive; it must never be cached by
    // a shared or browser cache.
    { headers: { "Cache-Control": "no-store" } },
  );
}
