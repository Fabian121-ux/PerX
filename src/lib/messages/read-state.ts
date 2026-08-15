import { getPrisma } from "@/lib/db/prisma";
import { buildConversationAccessWhere } from "@/lib/messages/access";

const readStateTransactionAttempts = 3;
const readStateRetryDelayMs = 25;

function isTransactionWriteConflict(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2034"
  );
}

export async function markConversationReadForUser(
  conversationId: string,
  userId: string,
  throughEntry?: { id: string; kind: "event" | "message" } | null,
) {
  const prisma = getPrisma();
  let transactionResult: {
    readThroughEntry: { createdAt: Date; id: string } | null;
  } | null = null;

  for (let attempt = 0; attempt < readStateTransactionAttempts; attempt += 1) {
    try {
      transactionResult = await prisma.$transaction(
        async (tx) => {
          const conversation = await tx.conversation.findFirst({
            select: {
              participants: {
                select: { id: true, lastReadAt: true },
                where: { removedAt: null, userId },
              },
            },
            where: {
              ...buildConversationAccessWhere(userId),
              id: conversationId,
            },
          });
          const participant = conversation?.participants[0];
          if (!participant) return null;

          await tx.$queryRaw`
            SELECT "id"
            FROM "ConversationParticipant"
            WHERE "id" = ${participant.id}
            FOR UPDATE
          `;

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
          if (throughEntry && !readThroughEntry) return null;

          const readThroughAt =
            readThroughEntry?.createdAt ?? participant.lastReadAt;

          if (readThroughAt) {
            await tx.conversationParticipant.updateMany({
              data: { lastReadAt: readThroughAt },
              where: {
                conversationId,
                OR: [
                  { lastReadAt: null },
                  { lastReadAt: { lt: readThroughAt } },
                ],
                removedAt: null,
                userId,
              },
            });
          }

          return { readThroughEntry };
        },
        { isolationLevel: "ReadCommitted", timeout: 30_000 },
      );
      break;
    } catch (error) {
      const finalAttempt = attempt === readStateTransactionAttempts - 1;
      if (!isTransactionWriteConflict(error) || finalAttempt) throw error;
      await new Promise((resolve) =>
        setTimeout(resolve, readStateRetryDelayMs * (attempt + 1)),
      );
    }
  }

  if (!transactionResult) return false;
  const { readThroughEntry } = transactionResult;
  if (!readThroughEntry) return true;

  const [unreadMessages] = await Promise.all([
    prisma.message.findMany({
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: { id: true },
      take: 100,
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
    }),
    prisma.notification.updateMany({
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
    }),
  ]);

  if (unreadMessages.length) {
    await prisma.messageReadReceipt.createMany({
      data: unreadMessages.map((message) => ({
        messageId: message.id,
        userId,
      })),
      skipDuplicates: true,
    });
  }

  return true;
}
