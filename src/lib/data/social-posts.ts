import { unstable_rethrow } from "next/navigation";
import type { Prisma } from "@/generated/prisma/client";
import { getEligibleNetworkUserWhere } from "@/features/network/eligibility";
import { getPrisma } from "@/lib/db/prisma";
import { logServerDataError } from "@/lib/logging/runtime";
import {
  encodeCursor,
  normalizeCursorPageParams,
  withCursor,
} from "@/lib/data/cursor";
import type { SocialPostView, SocialCommentView } from "@/lib/social/contracts";

/** Same account and bidirectional block semantics as public opportunity discovery. */
export function socialAuthorWhere(viewerId?: string): Prisma.UserWhereInput {
  return {
    ...getEligibleNetworkUserWhere(),
    profile: { is: { isDiscoverable: true } },
    ...(viewerId
      ? {
          blocksMade: { none: { blockedUserId: viewerId } },
          blocksReceived: { none: { blockerUserId: viewerId } },
        }
      : {}),
  };
}
/** Single predicate for feed, detail and engagement; knowing an ID grants nothing. */
export function socialPostWhere(viewerId?: string): Prisma.PostWhereInput {
  return {
    status: "PUBLISHED",
    moderationStatus: "APPROVED",
    deletedAt: null,
    publishedAt: { not: null },
    author: socialAuthorWhere(viewerId),
  };
}
export function socialCommentWhere(
  viewerId?: string,
): Prisma.PostCommentWhereInput {
  return {
    deletedAt: null,
    moderationStatus: "APPROVED",
    author: socialAuthorWhere(viewerId),
    post: socialPostWhere(viewerId),
  };
}
const authorSelect = {
  id: true,
  name: true,
  username: true,
  imageUrl: true,
} satisfies Prisma.UserSelect;
function postSelect(viewerId?: string) {
  return {
    id: true,
    body: true,
    publishedAt: true,
    author: { select: authorSelect },
    _count: {
      select: {
        reactions: { where: { user: socialAuthorWhere(viewerId) } },
        comments: { where: socialCommentWhere(viewerId) },
      },
    },
    // No anonymous lookup of viewer state, including no invented viewer identifier.
    ...(viewerId
      ? {
          reactions: {
            where: { userId: viewerId },
            select: { kind: true },
            take: 1,
          },
        }
      : {}),
  } satisfies Prisma.PostSelect;
}
type Row = Prisma.PostGetPayload<{ select: ReturnType<typeof postSelect> }>;
function project(row: Row, viewerId?: string): SocialPostView {
  return {
    kind: "SOCIAL_POST",
    id: row.id,
    body: row.body,
    author: row.author,
    publishedAt: row.publishedAt!.toISOString(),
    reactionCount: row._count.reactions,
    commentCount: row._count.comments,
    ...(viewerId ? { viewerReaction: row.reactions?.[0]?.kind ?? null } : {}),
  };
}
export async function getSocialFeed(viewerId?: string, rawCursor?: string) {
  const scope = `social-feed:${viewerId ?? "public"}`;
  const { cursor } = normalizeCursorPageParams({ cursor: rawCursor }, scope);
  const rows = await getPrisma().post.findMany({
    where: withCursor(socialPostWhere(viewerId), cursor, {
      direction: "desc",
      field: "publishedAt",
    }),
    select: postSelect(viewerId),
    orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
    take: 13,
  });
  const items = rows.slice(0, 12);
  return {
    items: items.map((row) => project(row, viewerId)),
    nextCursor:
      rows.length > 12
        ? encodeCursor({
            id: items.at(-1)!.id,
            timestamp: items.at(-1)!.publishedAt!,
            scope,
          })
        : null,
  };
}
export async function getSocialFeedResult(viewerId?: string) {
  try {
    return { ...(await getSocialFeed(viewerId)), unavailable: false };
  } catch (error) {
    unstable_rethrow(error);
    logServerDataError({ error, operation: "social feed", route: "/posts" });
    return { items: [], nextCursor: null, unavailable: true };
  }
}
export async function getSocialPost(
  id: string,
  viewerId?: string,
  rawCursor?: string,
) {
  const post = await getPrisma().post.findFirst({
    where: { ...socialPostWhere(viewerId), id },
    select: postSelect(viewerId),
  });
  if (!post) return null;
  const scope = `social-comments:${id}:${viewerId ?? "public"}`;
  const { cursor } = normalizeCursorPageParams({ cursor: rawCursor }, scope);
  const rows = await getPrisma().postComment.findMany({
    where: withCursor({ ...socialCommentWhere(viewerId), postId: id }, cursor, {
      direction: "asc",
      field: "createdAt",
    }),
    select: {
      id: true,
      body: true,
      createdAt: true,
      updatedAt: true,
      author: { select: authorSelect },
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: 21,
  });
  const comments: SocialCommentView[] = rows
    .slice(0, 20)
    .map((row) => ({
      ...row,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }));
  return {
    post: project(post, viewerId),
    comments,
    nextCursor:
      rows.length > 20
        ? encodeCursor({
            id: rows[19].id,
            timestamp: rows[19].createdAt,
            scope,
          })
        : null,
  };
}
