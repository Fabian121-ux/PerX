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
    if (!participant || participant.removedAt) {
      return { conversations: null, notFound: true };
    }
  }

  const conversations = await prisma.conversation.findMany({
    include: {
      events: {
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: conversationId ? 50 : 1,
      },
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
          deal: {
            select: {
              currency: true,
              id: true,
              proposalVersion: { select: { versionNumber: true } },
              settlementMode: true,
              status: true,
              valueMinor: true,
            },
          },
        },
        take: 1,
        where: { deal: { isNot: null } },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 50,
    where: {
      ...(conversationId ? { id: conversationId } : {}),
      participants: { some: { removedAt: null, userId } },
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
      const unreadMessageCount = conversation.messages.filter(
        (message) =>
          message.senderId !== userId &&
          (!participant?.lastReadAt ||
            message.createdAt > participant.lastReadAt),
      ).length;
      const unreadEventCount = conversation.events.filter(
        (event) =>
          event.actorId !== userId &&
          (!participant?.lastReadAt || event.createdAt > participant.lastReadAt),
      ).length;
      const latestMessage = conversation.messages[0];
      const latestEvent = conversation.events[0];
      const latestEventIsNewer =
        latestEvent &&
        (!latestMessage || latestEvent.createdAt > latestMessage.createdAt);

      return {
        context: conversation.opportunity?.title ?? "Professional conversation",
        deal: linkedDeal
          ? {
              amountMinor: linkedDeal.valueMinor.toString(),
              currency: linkedDeal.currency,
              id: linkedDeal.id,
              settlementMode: linkedDeal.settlementMode,
              status: linkedDeal.status,
              title: conversation.opportunity?.title ?? "PerX Deal",
              versionLabel: linkedDeal.proposalVersion
                ? `v${linkedDeal.proposalVersion.versionNumber}`
                : undefined,
            }
          : null,
        dealHref: linkedDeal ? `/app/deals/${linkedDeal.id}` : null,
        events: [...conversation.events].reverse().map((event) => ({
          actorName:
            conversation.participants.find(
              (entry) => entry.userId === event.actorId,
            )?.user.name ?? null,
          createdAt: event.createdAt.toISOString(),
          dealHref: event.dealId ? `/app/deals/${event.dealId}` : null,
          id: event.id,
          proposalVersionId: event.proposalVersionId,
          snapshot: toEventSnapshot(event.snapshot),
          type: event.type,
        })),
        id: conversation.id,
        lastMessage: latestEventIsNewer
          ? eventSummary(latestEvent.type)
          : latestMessage?.deletedAt
            ? "Message removed"
            : latestMessage?.body ?? "No messages yet.",
        messages: messages.map((message) => ({
          body: message.deletedAt ? "" : message.body,
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
        timestamp: (
          latestEventIsNewer
            ? latestEvent.createdAt
            : latestMessage?.createdAt ?? conversation.updatedAt
        ).toISOString(),
        unreadCount: unreadMessageCount + unreadEventCount,
      };
    }),
    notFound: false,
  };
}

function toEventSnapshot(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function eventSummary(type: string) {
  if (type === "PROPOSAL_OBJECTION_RAISED") return "Proposal revision requested";
  if (type === "PROPOSAL_ACCEPTED") return "Proposal accepted";
  if (type === "PROPOSAL_REJECTED") return "Proposal rejected";
  if (type === "DEAL_CREATED") return "Deal record created";
  if (type === "MILESTONE_SUBMITTED") return "Milestone delivery submitted";
  if (type === "MILESTONE_APPROVED") return "Milestone approved";
  if (type === "SIMULATED_RELEASE_RECORDED") return "Simulated release recorded";
  return "Proposal version submitted";
}

function getPresenceState(showPresence: boolean, lastSeenAt: Date | null) {
  if (!showPresence || !lastSeenAt) return "hidden";
  const ageMs = Date.now() - lastSeenAt.getTime();
  if (ageMs <= 2 * 60_000) return "online";
  if (ageMs <= 30 * 60_000) return "recent";
  return "offline";
}
