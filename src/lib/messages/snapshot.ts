import { getPrisma } from "@/lib/db/prisma";

type MessageSnapshotOptions = {
  conversationId?: string | null;
  userId: string;
};

export async function getMessageSnapshot({
  conversationId,
  userId,
}: MessageSnapshotOptions) {
  const prisma = getPrisma();

  if (conversationId) {
    const participant = await prisma.conversationParticipant.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId,
        },
      },
    });
    if (!participant) {
      return { conversations: null, notFound: true };
    }
  }

  const conversations = await prisma.conversation.findMany({
    include: {
      messages: {
        include: {
          readReceipts: { select: { userId: true } },
          replyTo: {
            select: {
              body: true,
              deletedAt: true,
              id: true,
              sender: { select: { id: true, name: true, username: true } },
              senderId: true,
            },
          },
          sender: {
            select: { id: true, imageUrl: true, name: true, username: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: conversationId ? 50 : 1,
      },
      opportunity: { select: { title: true } },
      participants: {
        include: {
          user: {
            select: {
              id: true,
              imageUrl: true,
              name: true,
              profile: {
                select: {
                  profileImageUrl: true,
                  showLastActiveTime: true,
                  showPresence: true,
                },
              },
              sessions: {
                orderBy: { lastSeenAt: "desc" },
                select: { lastSeenAt: true },
                take: 1,
              },
              username: true,
            },
          },
        },
      },
      proposals: {
        orderBy: { createdAt: "desc" },
        select: {
          deal: { select: { id: true, status: true } },
        },
        take: 1,
        where: { deal: { isNot: null } },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 50,
    where: {
      ...(conversationId ? { id: conversationId } : {}),
      participants: { some: { userId } },
      status: "ACTIVE",
    },
  });

  return {
    conversations: conversations.map((conversation) => {
      const participant = conversation.participants.find(
        (entry) => entry.userId === userId,
      );
      const other = conversation.participants.find(
        (entry) => entry.userId !== userId,
      )?.user;
      const otherParticipantIds = conversation.participants
        .map((entry) => entry.userId)
        .filter((participantId) => participantId !== userId);
      const messages = [...conversation.messages].reverse();
      const linkedDeal = conversation.proposals.find(
        (proposal) => proposal.deal,
      )?.deal;
      const unreadCount = conversation.messages.filter(
        (message) =>
          message.senderId !== userId &&
          (!participant?.lastReadAt ||
            message.createdAt > participant.lastReadAt),
      ).length;

      return {
        context: conversation.opportunity?.title ?? "Professional conversation",
        dealHref: linkedDeal ? `/app/deals/${linkedDeal.id}` : null,
        id: conversation.id,
        lastMessage: conversation.messages[0]?.body ?? "No messages yet.",
        messages: messages.map((message) => ({
          body: message.body,
          createdAt: message.createdAt.toISOString(),
          deletedAt: message.deletedAt?.toISOString() ?? null,
          editedAt: message.editedAt?.toISOString() ?? null,
          id: message.id,
          readByCurrentUser: message.readReceipts.some(
            (receipt) => receipt.userId === userId,
          ),
          readByOtherParticipants:
            otherParticipantIds.length > 0 &&
            otherParticipantIds.every((participantId) =>
              message.readReceipts.some(
                (receipt) => receipt.userId === participantId,
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
          senderName: message.sender.name,
        })),
        opportunityTitle: conversation.opportunity?.title ?? null,
        participantImageUrl:
          other?.imageUrl ?? other?.profile?.profileImageUrl ?? null,
        participantId: other?.id ?? null,
        participantName: other?.name ?? "Conversation",
        participantPresence: getPresenceState(
          other?.profile?.showPresence ?? false,
          other?.sessions[0]?.lastSeenAt ?? null,
        ),
        participantUsername: other?.username ?? null,
        timestamp:
          conversation.messages[0]?.createdAt.toISOString() ??
          conversation.updatedAt.toISOString(),
        unreadCount,
      };
    }),
    notFound: false,
  };
}

function getPresenceState(showPresence: boolean, lastSeenAt: Date | null) {
  if (!showPresence || !lastSeenAt) return "hidden";
  const ageMs = Date.now() - lastSeenAt.getTime();
  if (ageMs <= 2 * 60_000) return "online";
  if (ageMs <= 30 * 60_000) return "recent";
  return "offline";
}
