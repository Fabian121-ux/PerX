import { NotificationType } from "@/generated/prisma/enums";
import { getPrisma } from "@/lib/db/prisma";
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

export async function getUnreadCounts(userId: string): Promise<UnreadCounts> {
  const prisma = getPrisma();
  const now = new Date();
  const [
    messageRows,
    pendingConnectionRequests,
    unreadNews,
    generalActivity,
  ] = await Promise.all([
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
