import type { Prisma } from "@/generated/prisma/client";

export function buildConversationAccessWhere(
  userId: string,
): Prisma.ConversationWhereInput {
  return {
    participants: {
      none: {
        user: {
          OR: [
            { blocksMade: { some: { blockedUserId: userId } } },
            { blocksReceived: { some: { blockerUserId: userId } } },
          ],
        },
      },
      some: { removedAt: null, userId },
    },
    status: "ACTIVE",
  };
}
