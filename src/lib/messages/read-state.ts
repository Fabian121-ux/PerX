import { getPrisma } from "@/lib/db/prisma";

export async function markConversationReadForUser(
  conversationId: string,
  userId: string,
) {
  return getPrisma().$transaction(async (tx) => {
    const participant = await tx.conversationParticipant.findUnique({
      select: { id: true, lastReadAt: true, removedAt: true },
      where: {
        conversationId_userId: { conversationId, userId },
      },
    });
    if (!participant || participant.removedAt) return false;

    const [latestMessage, latestEvent] = await Promise.all([
      tx.message.findFirst({
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: { createdAt: true },
        where: { conversationId },
      }),
      tx.conversationEvent.findFirst({
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: { createdAt: true },
        where: { conversationId },
      }),
    ]);
    const latestEntryAt = [latestMessage?.createdAt, latestEvent?.createdAt]
      .filter((value): value is Date => Boolean(value))
      .sort((a, b) => b.getTime() - a.getTime())[0];
    const readThroughAt = latestEntryAt ?? participant.lastReadAt;
    const unreadMessages = readThroughAt
      ? await tx.message.findMany({
          select: { id: true },
          where: {
            conversationId,
            createdAt: { lte: readThroughAt },
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

    await tx.notification.updateMany({
      data: { readAt: new Date() },
      where: {
        OR: [
          { actionUrl: `/app/messages/${conversationId}` },
          { actionUrl: { startsWith: `/app/messages/${conversationId}?` } },
          { metadata: { path: ["conversationId"], equals: conversationId } },
        ],
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

    return true;
  });
}
