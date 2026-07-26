import { getPrisma } from "@/lib/db/prisma";

export type UnreadCounts = {
  messages: number;
  notifications: number;
};

export async function getUnreadCounts(userId: string): Promise<UnreadCounts> {
  const prisma = getPrisma();
  const [messageRows, notifications] = await Promise.all([
    prisma.$queryRaw<Array<{ count: bigint | number }>>`
      SELECT COUNT(DISTINCT cp."conversationId") AS count
      FROM "ConversationParticipant" cp
      JOIN "Conversation" c ON c."id" = cp."conversationId"
      JOIN "Message" m ON m."conversationId" = cp."conversationId"
      WHERE cp."userId" = ${userId}
        AND c."status" = 'ACTIVE'
        AND m."senderId" <> ${userId}
        AND (cp."lastReadAt" IS NULL OR m."createdAt" > cp."lastReadAt")
    `,
    prisma.notification.count({ where: { readAt: null, userId } }),
  ]);

  return {
    messages: Number(messageRows[0]?.count ?? 0),
    notifications,
  };
}
