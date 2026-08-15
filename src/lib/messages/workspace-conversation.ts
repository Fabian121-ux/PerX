/* eslint-disable @typescript-eslint/no-explicit-any */
import type { CurrentUser } from "@/lib/auth/session";
import type {
  WorkspaceConversation,
  WorkspaceConversationEvent,
} from "@/components/messages/message-workspace";
import { getServerEnv } from "@/lib/env";
import { hasCapability } from "@/lib/permissions/capabilities";

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
  _count?: { proposals: number };
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
    replyTo?: any;
    senderId: string;
  }[];
  opportunity?: {
    currency?: string;
    moderationStatus?: string;
    ownerId?: string;
    status?: string;
    title: string;
  } | null;
  participants: {
    user?: {
      imageUrl?: string | null;
      name: string | null;
      profile?: {
        biography?: string | null;
        headline?: string | null;
        location?: string | null;
        profileImageUrl?: string | null;
        showLocation?: boolean | null;
        showPresence?: boolean | null;
        showSkills?: boolean | null;
        skills?: { name: string }[];
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

export function toWorkspaceConversation(
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
  const mutationCutoff = new Date(
    Date.now() - getServerEnv().MESSAGE_EDIT_WINDOW_MINUTES * 60_000,
  );
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
    dealOffer: getConversationDealOffer(dbConversation, user),
    events: (dbConversation.events ?? []).map((event) => ({
      actorName:
        dbConversation.participants.find(
          (participant) => participant.userId === event.actorId,
        )?.user?.name ?? null,
      createdAt: event.createdAt.toISOString(),
      dealHref: event.dealId ? `/app/deals/${event.dealId}` : null,
      id: event.id,
      proposalVersionId: event.proposalVersionId ?? null,
      proposalHref: getConversationProposalHref(event.type, event.actorId, user.id),
      snapshot: toEventSnapshot(event.snapshot),
      type: event.type,
    })),
    historyLoaded: false,
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
            canMutate:
              !latestMessage.deletedAt && latestMessage.createdAt >= mutationCutoff,
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
            replyTo: toWorkspaceReply(latestMessage.replyTo),
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
    participantProfile: toParticipantProfilePreview(otherParticipant?.profile),
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

export function toParticipantProfilePreview(profile?: {
  biography?: string | null;
  headline?: string | null;
  location?: string | null;
  showLocation?: boolean | null;
  showSkills?: boolean | null;
  skills?: { name: string }[];
} | null): WorkspaceConversation["participantProfile"] {
  if (!profile) return undefined;
  return {
    biography: profile.biography?.trim() || "This member has not completed a biography.",
    headline: profile.headline?.trim() || "PerX member",
    location: profile.showLocation === false ? null : profile.location,
    skills:
      profile.showSkills === false
        ? []
        : (profile.skills ?? []).map((skill) => skill.name),
  };
}

export function getConversationDealOffer(
  conversation: Pick<
    DbConversationLike,
    "_count" | "opportunity" | "participants" | "proposals"
  >,
  user: Pick<CurrentUser, "id" | "roles">,
): WorkspaceConversation["dealOffer"] {
  const opportunity = conversation.opportunity;
  const otherParticipantIds = conversation.participants
    .map((participant) => participant.userId)
    .filter((participantId) => participantId !== user.id);
  const linkedDeal = conversation.proposals?.some((proposal) => proposal.deal);
  if (
    !hasCapability(user.roles, "proposal:create") ||
    !hasCapability(user.roles, "deal:view:participant") ||
    !opportunity ||
    opportunity.ownerId === user.id ||
    opportunity.ownerId !== otherParticipantIds[0] ||
    opportunity.status !== "PUBLISHED" ||
    opportunity.moderationStatus !== "APPROVED" ||
    conversation.participants.length !== 2 ||
    otherParticipantIds.length !== 1 ||
    linkedDeal ||
    (conversation._count?.proposals ?? 0) > 0 ||
    !opportunity.currency
  ) {
    return undefined;
  }
  return {
    currency: opportunity.currency,
    opportunityTitle: opportunity.title,
  };
}

export function getConversationProposalHref(
  type: WorkspaceConversationEvent["type"],
  actorId: string | null | undefined,
  userId: string,
) {
  if (
    type === "PROPOSAL_SUBMITTED" ||
    type === "PROPOSAL_REVISION_SUBMITTED"
  ) {
    return actorId === userId
      ? "/app/proposals/sent"
      : "/app/proposals/received";
  }
  if (type === "PROPOSAL_OBJECTION_RAISED") {
    return actorId === userId
      ? "/app/proposals/received"
      : "/app/proposals/sent";
  }
  return null;
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

function getPresenceState(showPresence: boolean, lastSeenAt?: Date | null) {
  if (!showPresence || !lastSeenAt) return "hidden";
  const ageMs = Date.now() - lastSeenAt.getTime();
  if (ageMs <= 2 * 60_000) return "online";
  if (ageMs <= 30 * 60_000) return "recent";
  return "offline";
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
