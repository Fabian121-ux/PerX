/* eslint-disable @typescript-eslint/no-explicit-any */
import { notFound, redirect } from "next/navigation";

import {
  MessageWorkspace,
  type WorkspaceConversation,
  type WorkspaceConversationEvent,
} from "@/components/messages/message-workspace";
import { getCurrentUser, type CurrentUser } from "@/lib/auth/session";
import {
  getConversationMessagesPage,
  getConversationForUser,
  getConversationsPage,
} from "@/lib/data/app";
import { MAX_CURSOR_PAGE_SIZE } from "@/lib/data/cursor";
import { getPrisma } from "@/lib/db/prisma";
import {
  findOwnedConversationEventTarget,
  findOwnedMessageTarget,
  parseMessageRouteId,
} from "@/lib/messages/entry";
import { createMessageMutationBaseline } from "@/lib/messages/mutations";
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
      messages: conversation.messages.map((message: any) => message),
      opportunityTitle: conversation.opportunityTitle,
      participantName: conversation.participantName,
      participantUsername: conversation.participantUsername,
      timestamp: "2m",
      unreadCount: 0,
    };
  }

  const dbConversation = conversation as DbConversationLike;
  const otherParticipant = dbConversation.participants
    .map((participant: any) => participant)
    .find((participant) => participant.userId !== user.id)?.user;
  const otherParticipantIds = dbConversation.participants
    .map((participant) => participant.userId)
    .filter((participantId) => participantId !== user.id);
  const latestMessage =
    dbConversation.messages.length > 1
      ? dbConversation.messages[dbConversation.messages.length - 1] // ascending full messages
      : dbConversation.messages[0]; // descending single message
  const linkedDeal = dbConversation.proposals?.find(
    (proposal) => proposal.deal,
  )?.deal;

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
    lastMessage: latestMessage?.deletedAt
      ? "Message removed"
      : (latestMessage?.body ?? "No messages yet."),
    messages: dbConversation.messages.map((msg) => ({
      body: msg.deletedAt ? "" : msg.body,
      createdAt: msg.createdAt.toISOString(),
      deletedAt: msg.deletedAt?.toISOString() ?? null,
      editedAt: msg.editedAt?.toISOString() ?? null,
      id: msg.id,
      readByOtherParticipants:
        otherParticipantIds.length > 0 &&
        otherParticipantIds.every((participantId) =>
          msg.readReceipts?.some((receipt) => receipt.userId === participantId),
        ),
      replyTo: toWorkspaceReply((msg as any).replyTo),
      senderId: msg.senderId,
      senderName:
        msg.senderId === user.id
          ? user.name
          : (otherParticipant?.name ?? "Participant"),
    })),
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
    timestamp: latestMessage
      ? latestMessage.createdAt.toLocaleDateString()
      : "new",
    unreadCount: 0,
  };
}

export default async function ConversationPage({
  params,
  searchParams,
}: {
  params: Promise<{ conversationId: string }>;
  searchParams: Promise<{
    event?: string | string[];
    message?: string | string[];
  }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const rawConversationId = (await params).conversationId;
  const conversationId = parseMessageRouteId(rawConversationId);
  if (!conversationId) notFound();
  const initialMutationCursor = createMessageMutationBaseline(
    user.id,
    conversationId,
  );
  const { event: rawHighlightEventId, message: rawHighlightMessageId } =
    await searchParams;
  const highlightEventId =
    rawHighlightEventId === undefined
      ? undefined
      : parseMessageRouteId(rawHighlightEventId);
  const highlightMessageId =
    rawHighlightMessageId === undefined
      ? undefined
      : parseMessageRouteId(rawHighlightMessageId);
  if (
    (rawHighlightEventId !== undefined && !highlightEventId) ||
    (rawHighlightMessageId !== undefined && !highlightMessageId)
  ) {
    notFound();
  }
  if (highlightEventId && highlightMessageId) notFound();
  const conversationPage = await loadConversationRouteData(
    "load-conversations",
    conversationId,
    () =>
      getConversationsPage(user.id, {
        pageSize: MAX_CURSOR_PAGE_SIZE,
      }),
  );
  let conversations = conversationPage.items;
  let selected = conversations.find(
    (conversation) => conversation.id === conversationId,
  );
  if (!selected) {
    const authorizedConversation = await loadConversationRouteData(
      "load-exact-conversation",
      conversationId,
      () => getConversationForUser(conversationId, user.id),
    );
    if (!authorizedConversation) notFound();
    conversations = [...conversations, authorizedConversation];
    selected = authorizedConversation;
  }
  if (!selected) notFound();

  const exactTarget = highlightMessageId
    ? await loadConversationRouteData(
        "load-message-target",
        conversationId,
        () =>
          findOwnedMessageTarget(user.id, {
            conversationId,
            messageId: highlightMessageId,
          }),
      )
    : null;
  if (highlightMessageId && !exactTarget) notFound();
  const exactEventTarget = highlightEventId
    ? await loadConversationRouteData("load-event-target", conversationId, () =>
        findOwnedConversationEventTarget(user.id, {
          conversationId,
          eventId: highlightEventId,
        }),
      )
    : null;
  if (highlightEventId && !exactEventTarget) notFound();

  const messagePage = await loadConversationRouteData(
    "load-message-history",
    conversationId,
    () =>
      getConversationMessagesPage(conversationId, user.id, {
        pageSize: MAX_CURSOR_PAGE_SIZE,
      }),
  );
  let fullMessages = messagePage.items;
  const olderMessagesCursor = messagePage.nextCursor;
  if (
    exactTarget &&
    !fullMessages.some((message) => message.id === exactTarget.id)
  ) {
    const targetMessage = await loadConversationRouteData(
      "load-older-message-target",
      conversationId,
      () =>
        getPrisma().message.findFirst({
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
          where: {
            conversationId,
            deletedAt: null,
            id: exactTarget.id,
          },
        }),
    );
    if (!targetMessage) notFound();
    fullMessages = [...fullMessages, targetMessage].sort((a, b) => {
      const timeDifference = a.createdAt.getTime() - b.createdAt.getTime();
      return timeDifference || a.id.localeCompare(b.id);
    });
  }

  (selected as DbConversationLike).messages = fullMessages;
  if (exactEventTarget) {
    const selectedWithEvents = selected as DbConversationLike & {
      events?: unknown[];
    };
    if (
      !selectedWithEvents.events?.some(
        (event: any) => event.id === exactEventTarget.id,
      )
    ) {
      selectedWithEvents.events = [
        ...(selectedWithEvents.events ?? []),
        exactEventTarget,
      ];
    }
  }
  const workspaceConversations: WorkspaceConversation[] = conversations.map(
    (conversation) => ({
      ...toWorkspaceConversation(conversation, user),
      historyLoaded: conversation.id === conversationId,
    }),
  );
  const selectedWorkspace = workspaceConversations.find(
    (conversation) => conversation.id === conversationId,
  );
  if (selectedWorkspace) selectedWorkspace.olderMessagesCursor = olderMessagesCursor;

  return (
    <MessageWorkspace
      backHref="/app/messages"
      conversations={workspaceConversations}
      currentUserId={user.id}
      defaultConversationId={conversationId}
      highlightEventId={exactEventTarget?.id}
      highlightMessageId={exactTarget?.id}
      initialMutationCursor={initialMutationCursor}
      olderConversationsCursor={conversationPage.nextCursor}
      key={`${conversationId}:${exactTarget?.id ?? exactEventTarget?.id ?? "latest"}`}
      userRoles={user.roles}
    />
  );
}

async function loadConversationRouteData<T>(
  operation: string,
  conversationId: string,
  load: () => Promise<T>,
) {
  try {
    return await load();
  } catch (error) {
    logServerDataError({
      error,
      operation,
      recordId: conversationId,
      requestId: await getRequestCorrelationId(),
      route: "/app/messages/[conversationId]",
    });
    throw error;
  }
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
