import type { Prisma } from "@/generated/prisma/client";
import {
  clampCursorPageSize,
  createCursorPage,
  normalizeCursorPageParams,
  withCursor,
  type CursorPageParams,
} from "@/lib/data/cursor";
import { buildPublicOpportunityWhere } from "@/lib/data/public-opportunities";
import { getPrisma } from "@/lib/db/prisma";
import { isProductionMockModeError } from "@/lib/env";
import { logServerDataError } from "@/lib/logging/runtime";
import { getTrustRecordEvidenceByUserIds } from "@/lib/trust/records";

/**
 * Home social feed.
 *
 * PerX has no separate `Post` table: a "post" is an `Opportunity`, which is why
 * this reuses `buildPublicOpportunityWhere` verbatim rather than growing a
 * second visibility filter. That helper is the single place where publication,
 * moderation, author eligibility and bidirectional blocking are enforced, so
 * the feed inherits every rule automatically - including anything added later.
 *
 * Ranking is deliberately explainable and cheap for this batch:
 *
 *   1. posts from accepted connections   (network segment)
 *   2. everything else that is visible   (discovery segment)
 *
 * Both segments are keyset-paginated on the same `[publishedAt desc, id desc]`
 * ordering, so the merged stream stays deterministic and duplicate-free without
 * an offset scan or a ranking table. No behavioural profiles, no embeddings -
 * those belong to Batch 8.
 */

/** Bounded initial page. Small enough to render fast, large enough to fill a tall desktop viewport. */
export const DEFAULT_HOME_FEED_PAGE_SIZE = 12;
export const MAX_HOME_FEED_PAGE_SIZE = 24;

/**
 * Cap on consecutive posts by one author within a single page.
 *
 * Prevents one prolific author owning the whole first screen. Applied per page
 * rather than globally so it stays deterministic under keyset pagination: a
 * global cap would need state carried across requests, and a cursor cannot
 * safely encode "how many of author A the viewer has already seen".
 */
export const MAX_CONSECUTIVE_POSTS_PER_AUTHOR = 2;

export type HomeFeedSegment = "network" | "discovery";

export type HomeFeedParams = CursorPageParams & {
  now?: Date;
  viewerId: string;
};

const homeFeedSelect = {
  budgetMaxMinor: true,
  budgetMinMinor: true,
  currency: true,
  id: true,
  images: {
    orderBy: [{ isCover: "desc" }, { createdAt: "asc" }],
    select: { altText: true, isCover: true, url: true },
    take: 1,
  },
  location: true,
  owner: {
    select: {
      emailVerifiedAt: true,
      id: true,
      imageUrl: true,
      name: true,
      profile: { select: { profileCompleteness: true, profileImageUrl: true } },
      username: true,
      verificationStatus: true,
    },
  },
  publishedAt: true,
  remote: true,
  slug: true,
  summary: true,
  title: true,
  type: true,
} satisfies Prisma.OpportunitySelect;

export type HomeFeedRow = Prisma.OpportunityGetPayload<{
  select: typeof homeFeedSelect;
}>;

export function clampHomeFeedPageSize(pageSize?: number) {
  if (pageSize === undefined || !Number.isFinite(pageSize)) {
    return DEFAULT_HOME_FEED_PAGE_SIZE;
  }

  return Math.max(1, Math.min(Math.trunc(pageSize), MAX_HOME_FEED_PAGE_SIZE));
}

/**
 * Cursor scope.
 *
 * Scoping by viewer AND segment means a cursor minted for one person's network
 * page cannot be replayed against another person's feed, and a network cursor
 * cannot be misread as a discovery cursor. `normalizeCursorPageParams` throws
 * on a mismatch before any query runs.
 */
export function getHomeFeedScope(viewerId: string, segment: HomeFeedSegment) {
  return `home-feed:${viewerId}:${segment}`;
}

/**
 * IDs of the viewer's accepted connections.
 *
 * `Connection` is directional at the row level (`@@unique([requesterId, receiverId])`)
 * but semantically mutual, so both directions are unioned. Bounded by `take` to
 * keep the follow-up `ownerId: { in: [...] }` predicate a sane size; a viewer
 * with more connections than the cap still gets a full feed because anything
 * omitted here remains reachable through the discovery segment.
 */
export async function getAcceptedConnectionIds(
  viewerId: string,
  limit = 500,
): Promise<string[]> {
  const rows = await getPrisma().connection.findMany({
    orderBy: { updatedAt: "desc" },
    select: { receiverId: true, requesterId: true },
    take: limit,
    where: {
      status: "ACCEPTED",
      OR: [{ requesterId: viewerId }, { receiverId: viewerId }],
    },
  });

  const ids = new Set<string>();
  for (const row of rows) {
    ids.add(row.requesterId === viewerId ? row.receiverId : row.requesterId);
  }
  ids.delete(viewerId);
  return [...ids];
}

/**
 * Interleave so no author holds more than `MAX_CONSECUTIVE_POSTS_PER_AUTHOR`
 * adjacent slots, while preserving recency as closely as possible.
 *
 * Deterministic and O(n): walk the recency-ordered list, and when the streak
 * cap would be exceeded, pull forward the nearest later post by a different
 * author. If no such post exists the original item is kept, so a feed that
 * genuinely only contains one author is never dropped or reordered pointlessly.
 */
export function applyAuthorDiversity<T extends { owner: { id: string } }>(
  items: readonly T[],
  maxConsecutive = MAX_CONSECUTIVE_POSTS_PER_AUTHOR,
): T[] {
  if (items.length <= maxConsecutive) return [...items];

  const remaining = [...items];
  const ordered: T[] = [];
  let lastAuthorId: string | null = null;
  let streak = 0;

  while (remaining.length) {
    let index = 0;
    if (lastAuthorId !== null && streak >= maxConsecutive) {
      const alternative = remaining.findIndex(
        (item) => item.owner.id !== lastAuthorId,
      );
      if (alternative !== -1) index = alternative;
    }

    const [next] = remaining.splice(index, 1);
    if (!next) break;
    ordered.push(next);

    if (next.owner.id === lastAuthorId) {
      streak += 1;
    } else {
      lastAuthorId = next.owner.id;
      streak = 1;
    }
  }

  return ordered;
}

async function queryFeedSegment({
  cursor,
  now,
  ownerFilter,
  pageSize,
  viewerId,
}: {
  cursor: ReturnType<typeof normalizeCursorPageParams>["cursor"];
  now: Date;
  ownerFilter: Prisma.OpportunityWhereInput;
  pageSize: number;
  viewerId: string;
}) {
  const rows = await getPrisma().opportunity.findMany({
    orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
    select: homeFeedSelect,
    // One extra row is the has-next-page probe; it is sliced off before return.
    take: pageSize + 1,
    where: withCursor<Prisma.OpportunityWhereInput>(
      {
        AND: [buildPublicOpportunityWhere({ viewerId }, now), ownerFilter],
      },
      cursor,
      { direction: "desc", field: "publishedAt" },
    ),
  });

  const hasNextPage = rows.length > pageSize;
  return { hasNextPage, rows: hasNextPage ? rows.slice(0, pageSize) : rows };
}

/**
 * One page of the Home feed.
 *
 * The viewer's own posts are intentionally included: publishing should be
 * visible to the author without a manual refresh, and hiding them made "where
 * did my post go?" the default experience.
 *
 * The stream is network-then-discovery. Rather than encoding that handoff into
 * the cursor, the response states the segment the next request should ask for.
 * An exhausted network segment therefore continues into discovery instead of
 * ending the feed, and the two segments partition authors so no post can be
 * served twice.
 */
export async function getHomeFeedPage({
  cursor: requestedCursor,
  now = new Date(),
  pageSize: requestedPageSize,
  segment,
  viewerId,
}: HomeFeedParams & { segment?: HomeFeedSegment }) {
  const resolvedSegment: HomeFeedSegment = segment ?? "network";
  const scope = getHomeFeedScope(viewerId, resolvedSegment);
  const { cursor, requestedCursor: normalizedCursor } =
    normalizeCursorPageParams({ cursor: requestedCursor }, scope);
  const pageSize = clampHomeFeedPageSize(requestedPageSize);

  // Needed by both segments: to include these authors, or to exclude them.
  const connectionIds = await getAcceptedConnectionIds(viewerId);
  const networkOwnerIds = [viewerId, ...connectionIds];

  const ownerFilter: Prisma.OpportunityWhereInput =
    resolvedSegment === "network"
      ? { ownerId: { in: networkOwnerIds } }
      : // Discovery excludes everyone the network segment already covered,
        // which is what keeps the merged stream duplicate-free.
        { ownerId: { notIn: networkOwnerIds } };

  let active = resolvedSegment;
  let { hasNextPage, rows } = await queryFeedSegment({
    cursor,
    now,
    ownerFilter,
    pageSize,
    viewerId,
  });

  /*
    Network produced nothing on its FIRST request - the viewer has no
    connections, or none of them have posted. Serve discovery immediately so
    the response still carries content instead of an empty page the client
    would have to chase with another round trip.

    Deliberately restricted to `!cursor`. Mid-stream (a cursor is present) an
    empty network page means that segment is simply finished, and restarting
    discovery from the top here would rewind the viewer to posts they have
    already scrolled past. That case is handled by the `nextSegment` handoff
    below, which lets the client request discovery as a separate page.
  */
  if (resolvedSegment === "network" && !rows.length && !cursor) {
    active = "discovery";
    ({ hasNextPage, rows } = await queryFeedSegment({
      cursor: null,
      now,
      ownerFilter: { ownerId: { notIn: networkOwnerIds } },
      pageSize,
      viewerId,
    }));
  }

  const trustEvidence = await getTrustRecordEvidenceByUserIds(
    rows.map((row) => row.owner.id),
  );
  // Diversity reorders within the returned window only - it never adds or drops
  // a row - so the keyset boundary below is unaffected.
  const diversified = applyAuthorDiversity(rows);
  const items = diversified.map((row) => ({
    ...row,
    owner: {
      ...row.owner,
      trustRecordEvidence: trustEvidence.get(row.owner.id),
    },
  }));

  const boundaryId = rows.at(-1)?.id;
  const page = createCursorPage(items, {
    cursor: normalizedCursor,
    getTimestamp: (item) => item.publishedAt ?? new Date(0),
    hasNextPage,
    // Continuation must follow the query's ordering, not the shuffled
    // presentation order, so the boundary row is the last row as fetched.
    nextCursorItem: boundaryId
      ? items.find((item) => item.id === boundaryId)
      : undefined,
    pageSize,
    scope: getHomeFeedScope(viewerId, active),
  });

  // Network exhausted: hand the client over to discovery, which starts from the
  // top of its own ordering and therefore needs no cursor.
  const handOffToDiscovery = active === "network" && !page.nextCursor;

  return {
    ...page,
    nextSegment: handOffToDiscovery
      ? ("discovery" as const)
      : page.nextCursor
        ? active
        : null,
    segment: active,
  };
}

/**
 * Degradation wrapper.
 *
 * Home must render even when the feed query fails - the shell, navigation and
 * every other module stay usable and the feed reports itself unavailable.
 * Mirrors `getAuthenticatedHomeOpportunityPageResult`.
 */
export async function getHomeFeedPageResult(
  params: HomeFeedParams & { segment?: HomeFeedSegment },
) {
  try {
    const page = await getHomeFeedPage(params);
    return { ...page, unavailable: false };
  } catch (error) {
    if (isProductionMockModeError(error)) throw error;
    // An invalid or replayed cursor is a client error, not an outage.
    if (
      error instanceof Error &&
      (error.message === "Invalid cursor." ||
        error.message === "Invalid cursor scope.")
    ) {
      throw error;
    }

    logServerDataError({
      error,
      operation: "home feed",
      route: "/app",
    });
    return {
      cursor: null,
      items: [] as Awaited<ReturnType<typeof getHomeFeedPage>>["items"],
      nextCursor: null,
      nextSegment: null,
      pageSize: clampCursorPageSize(params.pageSize),
      segment: params.segment ?? ("network" as HomeFeedSegment),
      unavailable: true,
    };
  }
}
