import { getPrisma } from "@/lib/db/prisma";
import { getServerEnv } from "@/lib/env";
import { buildConversationAccessWhere } from "@/lib/messages/access";

export async function getRealtimeWorkspaceMessage({
  conversationId,
  messageId,
  userId,
}: {
  conversationId: string;
  messageId: string;
  userId: string;
}) {
  const message = await getPrisma().message.findFirst({
    include: {
      conversation: {
        select: {
          participants: { select: { lastReadAt: true, userId: true } },
        },
      },
      readReceipts: { select: { userId: true } },
      replyTo: {
        select: {
          body: true,
          deletedAt: true,
          id: true,
          sender: { select: { name: true, username: true } },
          senderId: true,
        },
      },
      sender: {
        select: { imageUrl: true, name: true, username: true },
      },
    },
    where: {
      conversation: buildConversationAccessWhere(userId),
      conversationId,
      id: messageId,
    },
  });
  if (!message) return null;

  const receiptUserIds = new Set(
    message.readReceipts.map((receipt) => receipt.userId),
  );
  const otherParticipants = message.conversation.participants.filter(
    (participant) => participant.userId !== userId,
  );
  const currentParticipant = message.conversation.participants.find(
    (participant) => participant.userId === userId,
  );
  const mutationCutoff = new Date(
    Date.now() - getServerEnv().MESSAGE_EDIT_WINDOW_MINUTES * 60_000,
  );

  return {
    body: message.deletedAt ? "" : message.body,
    canMutate: !message.deletedAt && message.createdAt >= mutationCutoff,
    createdAt: message.createdAt.toISOString(),
    deletedAt: message.deletedAt?.toISOString() ?? null,
    editedAt: message.editedAt?.toISOString() ?? null,
    id: message.id,
    readByCurrentUser:
      receiptUserIds.has(userId) ||
      Boolean(
        currentParticipant?.lastReadAt &&
        message.createdAt <= currentParticipant.lastReadAt,
      ),
    readByOtherParticipants:
      otherParticipants.length > 0 &&
      otherParticipants.every(
        (participant) =>
          receiptUserIds.has(participant.userId) ||
          Boolean(
            participant.lastReadAt &&
            message.createdAt <= participant.lastReadAt,
          ),
      ),
    replyTo: message.replyTo
      ? {
          body: message.replyTo.deletedAt ? "" : message.replyTo.body,
          deletedAt: message.replyTo.deletedAt?.toISOString() ?? null,
          id: message.replyTo.id,
          senderId: message.replyTo.senderId,
          senderName:
            message.replyTo.sender.name ??
            message.replyTo.sender.username ??
            "Participant",
        }
      : null,
    senderId: message.senderId,
    senderImageUrl: message.sender.imageUrl ?? null,
    senderName: message.sender.name ?? message.sender.username ?? "Participant",
  };
}
