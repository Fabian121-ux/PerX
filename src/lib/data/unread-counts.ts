import { cache } from "react";

import { NotificationType } from "@/generated/prisma/enums";
import { getPrisma } from "@/lib/db/prisma";
import { maybeInjectFault } from "@/lib/testing/fault-injection";
import { getVisibleNewsWhere } from "@/lib/data/news";

export const MESSAGE_NOTIFICATION_TYPES = [
  NotificationType.MESSAGE,
  NotificationType.MESSAGE_REQUEST_RECEIVED,
  NotificationType.NEW_MESSAGE,
] as const;

export const CONNECTION_NOTIFICATION_TYPES = [
  NotificationType.CONNECTION,
  NotificationType.CONNECTION_REQUEST_ACCEPTED,
  NotificationType.CONNECTION_REQUEST_DECLINED,
  NotificationType.CONNECTION_REQUEST_RECEIVED,
] as const;

export const GENERAL_ACTIVITY_EXCLUDED_NOTIFICATION_TYPES = [
  NotificationType.BROADCAST,
  ...MESSAGE_NOTIFICATION_TYPES,
  ...CONNECTION_NOTIFICATION_TYPES,
] as const;

export type UnreadCounts = {
  generalActivity: number;
  pendingConnectionRequests: number;
  unreadConversations: number;
  unreadNews: number;
};

async function loadUnreadCounts(userId: string): Promise<UnreadCounts> {
  const prisma = getPrisma();
  const now = new Date();
  const [messageRows, pendingConnectionRequests, unreadNews, generalActivity] =
    await Promise.all([
      prisma.$queryRaw<Array<{ count: bigint | number }>>`
      SELECT COUNT(DISTINCT cp."conversationId") AS count
      FROM "ConversationParticipant" cp
      JOIN "Conversation" c ON c."id" = cp."conversationId"
      JOIN "Message" m ON m."conversationId" = cp."conversationId"
      WHERE cp."userId" = ${userId}
        AND c."status" = 'ACTIVE'
        AND m."senderId" <> ${userId}
        AND (cp."lastReadAt" IS NULL OR m."createdAt" > cp."lastReadAt")
        AND NOT EXISTS (
          SELECT 1
          FROM "BlockedUser" b
          WHERE
            (b."blockerUserId" = ${userId} AND b."blockedUserId" = m."senderId")
            OR
            (b."blockedUserId" = ${userId} AND b."blockerUserId" = m."senderId")
        )
    `,
      prisma.connection.count({
        where: { receiverId: userId, status: "PENDING" },
      }),
      prisma.notification.count({
        where: {
          ...getVisibleNewsWhere(userId, now),
          readAt: null,
        },
      }),
      prisma.notification.count({
        where: {
          readAt: null,
          type: {
            notIn: [...GENERAL_ACTIVITY_EXCLUDED_NOTIFICATION_TYPES],
          },
          userId,
        },
      }),
    ]);

  return {
    generalActivity,
    pendingConnectionRequests,
    unreadConversations: Number(messageRows[0]?.count ?? 0),
    unreadNews,
  };
}

/**
 * Per-request memoised unread counts.
 *
 * The authenticated layout renders these as navigation badges and Home renders
 * them again in its rail, so an uncached call meant every Home load issued
 * these four queries twice. React's `cache` scopes the result to a single
 * server request, matching how `getCurrentUser` is deduped in
 * `src/lib/auth/session.ts`.
 *
 * Safe to memoise: the value is derived per `userId`, is presentational
 * (badge counts), and never grants access. The cache lives for one render pass
 * only, so a subsequent request always re-reads the database.
 */
const EMPTY_UNREAD_COUNTS: UnreadCounts = {
  generalActivity: 0,
  pendingConnectionRequests: 0,
  unreadConversations: 0,
  unreadNews: 0,
};

/**
 * Badge counts are optional, so a failure here must not be fatal.
 *
 * These are awaited by the authenticated layout *and* by Home. Before this
 * guard, one failing aggregate took down every authenticated page - a
 * presentational badge became an app-wide critical dependency. Degrading to
 * zeroed counts keeps navigation and the feed usable; the badge is simply
 * absent until the next request succeeds.
 */
async function loadUnreadCountsSafely(userId: string): Promise<UnreadCounts> {
  try {
    // Inside the guard: the injected fault must stand in for the dependency
    // failing, so it has to travel the same path a real query error would.
    await maybeInjectFault("unread-counts");
    return await loadUnreadCounts(userId);
  } catch (error) {
    console.error("[perx:unread-counts]", {
      operation: "loadUnreadCounts",
      timestamp: new Date().toISOString(),
    });
    void error;
    return EMPTY_UNREAD_COUNTS;
  }
}

export const getUnreadCounts: (userId: string) => Promise<UnreadCounts> = cache(
  loadUnreadCountsSafely,
);
