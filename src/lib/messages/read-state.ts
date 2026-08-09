import { getPrisma } from "@/lib/db/prisma";
import { buildConversationAccessWhere } from "@/lib/messages/access";

export async function markConversationReadForUser(
  conversationId: string,
  userId: string,
  throughEntry?: { id: string; kind: "event" | "message" } | null,
) {
  return getPrisma().$transaction(async (tx) => {
    const conversation = await tx.conversation.findFirst({
      select: {
        participants: {
          select: { id: true, lastReadAt: true },
          where: { removedAt: null, userId },
        },
      },
      where: { ...buildConversationAccessWhere(userId), id: conversationId },
    });
    const participant = conversation?.participants[0];
    if (!participant) return false;

    const readThroughEntry = throughEntry
      ? throughEntry.kind === "message"
        ? await tx.message.findFirst({
            select: { createdAt: true, id: true },
            where: { conversationId, id: throughEntry.id },
          })
        : await tx.conversationEvent.findFirst({
            select: { createdAt: true, id: true },
            where: { conversationId, id: throughEntry.id },
          })
      : null;
    if (throughEntry && !readThroughEntry) return false;

    const readThroughAt = readThroughEntry?.createdAt ?? participant.lastReadAt;
    const unreadMessages = readThroughEntry
      ? await tx.message.findMany({
          select: { id: true },
          where: {
            conversationId,
            OR: [
              { createdAt: { lt: readThroughEntry.createdAt } },
              {
                createdAt: readThroughEntry.createdAt,
                id: { lte: readThroughEntry.id },
              },
            ],
            readReceipts: { none: { userId } },
            senderId: { not: userId },
          },
        })
      : [];

    if (
      readThroughAt &&
      (!participant.lastReadAt || participant.lastReadAt < readThroughAt)
    ) {
      await tx.conversationParticipant.update({
        data: { lastReadAt: readThroughAt },
        where: {
          conversationId_userId: { conversationId, userId },
        },
      });
    }

    if (unreadMessages.length) {
      await tx.messageReadReceipt.createMany({
        data: unreadMessages.map((message) => ({
          messageId: message.id,
          userId,
        })),
        skipDuplicates: true,
      });
    }

    if (readThroughEntry) {
      await tx.notification.updateMany({
        data: { readAt: new Date() },
        where: {
          OR: [
            { actionUrl: `/app/messages/${conversationId}` },
            { actionUrl: { startsWith: `/app/messages/${conversationId}?` } },
            { metadata: { path: ["conversationId"], equals: conversationId } },
          ],
          createdAt: { lte: readThroughEntry.createdAt },
          readAt: null,
          type: {
            in: [
              "DEAL",
              "DEAL_UPDATE",
              "MESSAGE",
              "MESSAGE_REQUEST_RECEIVED",
              "NEW_MESSAGE",
              "PROPOSAL",
              "PROPOSAL_UPDATE",
            ],
          },
          userId,
        },
      });
    }

    return true;
  }, { isolationLevel: "RepeatableRead" });
}
