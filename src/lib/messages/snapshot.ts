import { getPrisma } from "@/lib/db/prisma";
import { encodeCursor } from "@/lib/data/cursor";
import { buildConversationAccessWhere } from "@/lib/messages/access";
import { getServerEnv } from "@/lib/env";
import type { Prisma } from "@/generated/prisma/client";
import type { RoleName } from "@/lib/permissions/capabilities";
import {
  getConversationDealOffer,
  getConversationProposalHref,
  toParticipantProfilePreview,
} from "@/lib/messages/workspace-conversation";

type MessageSnapshotOptions = {
  conversationId?: string | null;
  includeConversationList?: boolean;
  userId: string;
  userRoles?: RoleName[];
};

type ConversationSnapshotRow = Prisma.ConversationGetPayload<{
  include: ReturnType<typeof conversationSnapshotInclude>;
}>;

type ConversationListSnapshot = {
  ids: string[];
  nextCursor: string | null;
};

type InitialUnreadMessage = Prisma.MessageGetPayload<{
  include: ReturnType<typeof messageSnapshotInclude>;
}>;

export async function getInitialUnreadMessage(
  conversationId: string,
  userId: string,
  lastReadAt: Date | null,
): Promise<InitialUnreadMessage | null> {
  return getPrisma().message.findFirst({
    include: messageSnapshotInclude(),
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    where: {
      conversation: buildConversationAccessWhere(userId),
      conversationId,
      ...(lastReadAt ? { createdAt: { gt: lastReadAt } } : {}),
      readReceipts: { none: { userId } },
      senderId: { not: userId },
    },
  });
}

export async function getMessageSnapshot({
  conversationId,
  includeConversationList = true,
  userId,
  userRoles = [],
}: MessageSnapshotOptions) {
  const prisma = getPrisma();
  const accessWhere = buildConversationAccessWhere(userId);
  const loadConversations = (fullHistory: boolean, exactId?: string) =>
    prisma.conversation.findMany({
      include: conversationSnapshotInclude(fullHistory),
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: exactId ? 1 : 51,
      where: { ...accessWhere, ...(exactId ? { id: exactId } : {}) },
    });
  let conversations;
  if (conversationId) {
    if (!includeConversationList) {
      const exactConversations = await loadConversations(true, conversationId);
      const initialUnreadMessage = exactConversations[0]
        ? await getInitialUnreadMessage(
            conversationId,
            userId,
            exactConversations[0].participants.find(
              (participant) => participant.userId === userId,
            )?.lastReadAt ?? null,
          )
        : null;
      return exactConversations.length
        ? formatMessageSnapshot(
            exactConversations,
            conversationId,
            userId,
            userRoles,
            null,
            initialUnreadMessage,
          )
        : { conversationList: null, conversations: null, notFound: true };
    }
    const [exactConversations, listConversations] = await Promise.all([
      loadConversations(true, conversationId),
      loadConversations(false),
    ]);
    if (!exactConversations.length) {
      return { conversationList: null, conversations: null, notFound: true };
    }
    const visibleListConversations = listConversations.slice(0, 50);
    const conversationsById = new Map(
      visibleListConversations.map((conversation) => [
        conversation.id,
        conversation,
      ]),
    );
    conversationsById.set(conversationId, exactConversations[0]!);
    conversations = [...conversationsById.values()];
    const initialUnreadMessage = await getInitialUnreadMessage(
      conversationId,
      userId,
      exactConversations[0]!.participants.find(
        (participant) => participant.userId === userId,
      )?.lastReadAt ?? null,
    );
    return formatMessageSnapshot(
      conversations,
      conversationId,
      userId,
      userRoles,
      conversationListSnapshot(listConversations, userId),
      initialUnreadMessage,
    );
  } else {
    const listConversations = await loadConversations(false);
    conversations = listConversations.slice(0, 50);
    return formatMessageSnapshot(
      conversations,
      conversationId,
      userId,
      userRoles,
      conversationListSnapshot(listConversations, userId),
      null,
    );
  }
}

function formatMessageSnapshot(
  conversations: ConversationSnapshotRow[],
  conversationId: string | null | undefined,
  userId: string,
  userRoles: RoleName[],
  conversationList: ConversationListSnapshot | null,
  initialUnreadMessage: InitialUnreadMessage | null,
) {
  const mutationCutoff = new Date(
    Date.now() - getServerEnv().MESSAGE_EDIT_WINDOW_MINUTES * 60_000,
  );
  return {
    conversationList,
    conversations: conversations.map((conversation) => {
      const fullHistory = conversation.id === conversationId;
      const participant = conversation.participants.find(
        (entry) => entry.userId === userId,
      );
      const other = conversation.participants.find(
        (entry) => entry.userId !== userId,
      )?.user;
      const otherParticipantIds = conversation.participants
        .map((entry) => entry.userId)
        .filter((participantId) => participantId !== userId);
      const visibleMessages = conversation.messages.slice(
        0,
        fullHistory ? 50 : 1,
      );
      const messages = [...visibleMessages].reverse();
      if (
        fullHistory &&
        initialUnreadMessage &&
        !messages.some((message) => message.id === initialUnreadMessage.id)
      ) {
        messages.push(initialUnreadMessage);
        messages.sort((left, right) => {
          const timeDifference =
            left.createdAt.getTime() - right.createdAt.getTime();
          return timeDifference || left.id.localeCompare(right.id);
        });
      }
      const olderMessagesCursor =
        fullHistory && conversation.messages.length > visibleMessages.length
          ? encodeCursor({
              id: visibleMessages.at(-1)!.id,
              scope: `messages:${userId}:${conversation.id}`,
              timestamp: visibleMessages.at(-1)!.createdAt,
            })
          : null;
      const linkedDeal = conversation.proposals.find(
        (proposal) => proposal.deal,
      )?.deal;
      const unreadMessageCount = visibleMessages.filter(
        (message) =>
          message.senderId !== userId &&
          !message.readReceipts.some((receipt) => receipt.userId === userId) &&
          (!participant?.lastReadAt ||
            message.createdAt > participant.lastReadAt),
      ).length;
      const unreadEventCount = conversation.events.filter(
        (event) =>
          event.actorId !== userId &&
          (!participant?.lastReadAt ||
            event.createdAt > participant.lastReadAt),
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
        dealOffer: getConversationDealOffer(conversation, {
          id: userId,
          roles: userRoles,
        }),
        events: [...conversation.events].reverse().map((event) => ({
          actorName:
            conversation.participants.find(
              (entry) => entry.userId === event.actorId,
            )?.user.name ?? null,
          createdAt: event.createdAt.toISOString(),
          dealHref: event.dealId ? `/app/deals/${event.dealId}` : null,
          id: event.id,
          proposalVersionId: event.proposalVersionId,
          proposalHref: getConversationProposalHref(
            event.type,
            event.actorId,
            userId,
          ),
          snapshot: toEventSnapshot(event.snapshot),
          type: event.type,
        })),
        historyLoaded: fullHistory,
        id: conversation.id,
        initialUnreadMessageId: fullHistory
          ? (initialUnreadMessage?.id ?? null)
          : undefined,
        lastMessage: latestEventIsNewer
          ? eventSummary(latestEvent.type)
          : latestMessage?.deletedAt
            ? "Message removed"
            : (latestMessage?.body ?? "No messages yet."),
        messages: messages.map((message) => ({
          body: message.deletedAt ? "" : message.body,
          canMutate: !message.deletedAt && message.createdAt >= mutationCutoff,
          createdAt: message.createdAt.toISOString(),
          deletedAt: message.deletedAt?.toISOString() ?? null,
          editedAt: message.editedAt?.toISOString() ?? null,
          id: message.id,
          readByCurrentUser:
            message.readReceipts.some((receipt) => receipt.userId === userId) ||
            Boolean(
              participant?.lastReadAt &&
              message.createdAt <= participant.lastReadAt,
            ),
          readByOtherParticipants:
            otherParticipantIds.length > 0 &&
            conversation.participants
              .filter((entry) => entry.userId !== userId)
              .every(
                (entry) =>
                  message.readReceipts.some(
                    (receipt) => receipt.userId === entry.userId,
                  ) ||
                  Boolean(
                    entry.lastReadAt && message.createdAt <= entry.lastReadAt,
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
        olderMessagesCursor,
        opportunityTitle: conversation.opportunity?.title ?? null,
        participantImageUrl:
          other?.imageUrl ?? other?.profile?.profileImageUrl ?? null,
        participantId: other?.id ?? null,
        participantName: other?.name ?? "Conversation",
        participantPresence: getPresenceState(
          other?.profile?.showPresence ?? false,
          other?.sessions[0]?.lastSeenAt ?? null,
        ),
        participantProfile: toParticipantProfilePreview(other?.profile),
        participantUsername: other?.username ?? null,
        timestamp: (latestEventIsNewer
          ? latestEvent.createdAt
          : (latestMessage?.createdAt ?? conversation.updatedAt)
        ).toISOString(),
        unreadCount: unreadMessageCount + unreadEventCount,
      };
    }),
    notFound: false,
  };
}

function conversationListSnapshot(
  rows: ConversationSnapshotRow[],
  userId: string,
): ConversationListSnapshot {
  const visibleRows = rows.slice(0, 50);
  const cursorRow = visibleRows.at(-1);
  return {
    ids: visibleRows.map((conversation) => conversation.id),
    nextCursor:
      rows.length > 50 && cursorRow
        ? encodeCursor({
            id: cursorRow.id,
            scope: `conversations:${userId}`,
            timestamp: cursorRow.updatedAt,
          })
        : null,
  };
}

function conversationSnapshotInclude(fullHistory: boolean) {
  return {
    _count: {
      select: {
        proposals: {
          where: {
            status: { in: ["DRAFT", "SENT", "COUNTERED", "ACCEPTED"] },
          },
        },
      },
    },
    events: {
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: fullHistory ? 50 : 1,
    },
    messages: {
      include: messageSnapshotInclude(),
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: fullHistory ? 51 : 1,
    },
    opportunity: {
      select: {
        currency: true,
        moderationStatus: true,
        ownerId: true,
        status: true,
        title: true,
      },
    },
    participants: {
      include: {
        user: {
          select: {
            id: true,
            imageUrl: true,
            name: true,
            profile: {
              select: {
                // Only the opened conversation needs the biography: it renders
                // in the details drawer for one participant. Selecting it for
                // every row shipped up to 1600 characters per conversation on
                // every snapshot, including the periodic reconciliation.
                biography: fullHistory,
                headline: true,
                location: true,
                profileImageUrl: true,
                showLastActiveTime: true,
                showLocation: true,
                showPresence: true,
                showSkills: true,
                skills: {
                  orderBy: { name: "asc" },
                  select: { name: true },
                  take: 12,
                },
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
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
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
  } satisfies Prisma.ConversationInclude;
}

function messageSnapshotInclude() {
  return {
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
  } satisfies Prisma.MessageInclude;
}

function toEventSnapshot(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function eventSummary(type: string) {
  if (type === "PROPOSAL_OBJECTION_RAISED")
    return "Proposal revision requested";
  if (type === "PROPOSAL_ACCEPTED") return "Proposal accepted";
  if (type === "PROPOSAL_REJECTED") return "Proposal rejected";
  if (type === "DEAL_CREATED") return "Deal record created";
  if (type === "MILESTONE_SUBMITTED") return "Milestone delivery submitted";
  if (type === "MILESTONE_APPROVED") return "Milestone approved";
  if (type === "SIMULATED_RELEASE_RECORDED")
    return "Simulated release recorded";
  return "Proposal version submitted";
}

function getPresenceState(showPresence: boolean, lastSeenAt: Date | null) {
  if (!showPresence || !lastSeenAt) return "hidden";
  const ageMs = Date.now() - lastSeenAt.getTime();
  if (ageMs <= 2 * 60_000) return "online";
  if (ageMs <= 30 * 60_000) return "recent";
  return "offline";
}
