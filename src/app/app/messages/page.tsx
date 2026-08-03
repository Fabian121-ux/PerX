/* eslint-disable @typescript-eslint/no-explicit-any */
import { redirect } from "next/navigation";

import {
  MessageWorkspace,
  type WorkspaceConversation,
  type WorkspaceConversationEvent,
} from "@/components/messages/message-workspace";
import { getCurrentUser, type CurrentUser } from "@/lib/auth/session";
import { getConversations } from "@/lib/data/app";
import {
  getRequestCorrelationId,
  logServerDataError,
} from "@/lib/logging/runtime";

type PreviewConversationLike = {
  id: string;
  lastMessage?: string;
  messages: {
    body: string;
    createdAt: string;
    id: string;
    senderId: string;
    senderName: string;
  }[];
  opportunityTitle: string;
  participantName: string;
  participantUsername?: string;
};

type DbConversationLike = {
  events?: {
    actorId?: string | null;
    createdAt: Date;
    dealId?: string | null;
    id: string;
    proposalVersionId?: string | null;
    snapshot: unknown;
    type: WorkspaceConversationEvent["type"];
  }[];
  id: string;
  messages: {
    body: string;
    createdAt: Date;
    deletedAt?: Date | null;
    editedAt?: Date | null;
    id: string;
    readReceipts?: { userId: string }[];
    senderId: string;
  }[];
  opportunity?: { title: string } | null;
  participants: {
    user?: {
      imageUrl?: string | null;
      name: string | null;
      profile?: {
        profileImageUrl?: string | null;
        showPresence?: boolean | null;
      } | null;
      sessions?: { lastSeenAt: Date }[];
      username: string | null;
    } | null;
    userId: string;
    lastReadAt?: Date | null;
  }[];
  proposals?: {
    deal?: {
      currency: string;
      id: string;
      proposalVersion?: { versionNumber: number } | null;
      settlementMode?: "SIMULATED" | "PROVIDER_DISABLED";
      status: string;
      valueMinor: bigint;
    } | null;
  }[];
};

function getPresenceState(showPresence: boolean, lastSeenAt?: Date | null) {
  if (!showPresence || !lastSeenAt) return "hidden";
  const ageMs = Date.now() - lastSeenAt.getTime();
  if (ageMs <= 2 * 60_000) return "online";
  if (ageMs <= 30 * 60_000) return "recent";
  return "offline";
}

function isPreviewConversation(
  conversation: unknown,
): conversation is PreviewConversationLike {
  return (
    Boolean(conversation) &&
    typeof conversation === "object" &&
    typeof (conversation as { participantName?: unknown }).participantName ===
      "string" &&
    Array.isArray((conversation as { messages?: unknown }).messages)
  );
}

function toWorkspaceConversation(
  conversation: unknown,
  user: CurrentUser,
): WorkspaceConversation {
  if (isPreviewConversation(conversation)) {
    return {
      context: conversation.opportunityTitle,
      id: conversation.id,
      lastMessage: conversation.lastMessage,
      messages: conversation.messages,
      opportunityTitle: conversation.opportunityTitle,
      participantName: conversation.participantName,
      participantUsername: conversation.participantUsername,
      timestamp: "2m",
      unreadCount: 1,
    };
  }

  const dbConversation = conversation as DbConversationLike;
  const currentParticipant = dbConversation.participants.find(
    (participant) => participant.userId === user.id,
  );
  const otherParticipant = dbConversation.participants.find(
    (participant) => participant.userId !== user.id,
  )?.user;
  const otherParticipantIds = dbConversation.participants
    .map((participant) => participant.userId)
    .filter((participantId) => participantId !== user.id);
  const latestMessage = dbConversation.messages[0];
  const latestEvent = [...(dbConversation.events ?? [])].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  )[0];
  const linkedDeal = dbConversation.proposals?.find(
    (proposal) => proposal.deal,
  )?.deal;
  const unreadMessageCount =
    latestMessage &&
    latestMessage.senderId !== user.id &&
    (!currentParticipant?.lastReadAt ||
      latestMessage.createdAt > currentParticipant.lastReadAt)
      ? 1
      : 0;
  const unreadEventCount = (dbConversation.events ?? []).filter(
    (event) =>
      event.actorId !== user.id &&
      (!currentParticipant?.lastReadAt ||
        event.createdAt > currentParticipant.lastReadAt),
  ).length;
  const latestEventIsNewer =
    latestEvent &&
    (!latestMessage || latestEvent.createdAt > latestMessage.createdAt);

  return {
    context: dbConversation.opportunity?.title ?? "Professional conversation",
    deal: linkedDeal
      ? {
          amountMinor: linkedDeal.valueMinor.toString(),
          currency: linkedDeal.currency,
          id: linkedDeal.id,
          settlementMode: linkedDeal.settlementMode,
          status: linkedDeal.status,
          title: dbConversation.opportunity?.title ?? "PerX Deal",
          versionLabel: linkedDeal.proposalVersion
            ? `v${linkedDeal.proposalVersion.versionNumber}`
            : undefined,
        }
      : undefined,
    dealHref: linkedDeal ? `/app/deals/${linkedDeal.id}` : undefined,
    events: (dbConversation.events ?? []).map((event) => ({
      actorName:
        dbConversation.participants.find(
          (participant) => participant.userId === event.actorId,
        )?.user?.name ?? null,
      createdAt: event.createdAt.toISOString(),
      dealHref: event.dealId ? `/app/deals/${event.dealId}` : null,
      id: event.id,
      proposalVersionId: event.proposalVersionId ?? null,
      snapshot: toEventSnapshot(event.snapshot),
      type: event.type,
    })),
    id: dbConversation.id,
    lastMessage: latestEventIsNewer
      ? eventSummary(latestEvent.type)
      : latestMessage?.deletedAt
        ? "Message removed"
        : (latestMessage?.body ?? "No messages yet."),
    messages: latestMessage
      ? [
          {
            body: latestMessage.deletedAt ? "" : latestMessage.body,
            createdAt: latestMessage.createdAt.toISOString(),
            deletedAt: latestMessage.deletedAt?.toISOString() ?? null,
            editedAt: latestMessage.editedAt?.toISOString() ?? null,
            id: latestMessage.id,
            readByOtherParticipants:
              otherParticipantIds.length > 0 &&
              otherParticipantIds.every((participantId) =>
                latestMessage.readReceipts?.some(
                  (receipt) => receipt.userId === participantId,
                ),
              ),
            replyTo: toWorkspaceReply((latestMessage as any).replyTo),
            senderId: latestMessage.senderId,
            senderName:
              latestMessage.senderId === user.id
                ? user.name
                : (otherParticipant?.name ?? "Participant"),
          },
        ]
      : [],
    opportunityTitle: dbConversation.opportunity?.title ?? undefined,
    participantId:
      dbConversation.participants.find(
        (participant) => participant.userId !== user.id,
      )?.userId ?? null,
    participantImageUrl:
      otherParticipant?.imageUrl ??
      otherParticipant?.profile?.profileImageUrl ??
      null,
    participantName:
      otherParticipant?.name ??
      dbConversation.opportunity?.title ??
      "Conversation",
    participantPresence: getPresenceState(
      Boolean(otherParticipant?.profile?.showPresence),
      otherParticipant?.sessions?.[0]?.lastSeenAt ?? null,
    ),
    participantRole: "Opportunity participant",
    participantUsername: otherParticipant?.username ?? undefined,
    timestamp:
      (latestEventIsNewer
        ? latestEvent?.createdAt
        : latestMessage?.createdAt
      )?.toISOString() ?? "new",
    unreadCount: unreadMessageCount + unreadEventCount,
  };
}

export default async function MessagesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  let conversations;
  try {
    conversations = await getConversations(user.id);
  } catch (error) {
    logServerDataError({
      error,
      operation: "load-conversations",
      recordId: user.id,
      requestId: await getRequestCorrelationId(),
      route: "/app/messages",
    });
    throw error;
  }
  const workspaceConversations = conversations.map((conversation: any) =>
    toWorkspaceConversation(conversation, user),
  );

  return (
    <MessageWorkspace
      conversations={workspaceConversations}
      currentUserId={user.id}
      userRoles={user.roles}
    />
  );
}

function toWorkspaceReply(replyTo: any) {
  if (!replyTo) return null;
  return {
    body: replyTo.deletedAt ? "" : replyTo.body,
    deletedAt: replyTo.deletedAt
      ? (replyTo.deletedAt.toISOString?.() ?? String(replyTo.deletedAt))
      : null,
    id: replyTo.id,
    senderId: replyTo.senderId,
    senderName:
      replyTo.sender?.name ?? replyTo.sender?.username ?? "Participant",
  };
}

function toEventSnapshot(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function eventSummary(type: WorkspaceConversationEvent["type"]) {
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
