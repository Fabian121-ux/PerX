/* eslint-disable @typescript-eslint/no-explicit-any */
import { notFound, redirect } from "next/navigation";

import {
  MessageWorkspace,
  type WorkspaceConversation,
} from "@/components/messages/message-workspace";
import { getCurrentUser, type CurrentUser } from "@/lib/auth/session";
import { getConversations } from "@/lib/data/app";
import { getPrisma } from "@/lib/db/prisma";

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
  proposals?: { deal?: { id: string; status: string } | null }[];
};

type DbMessageLike = {
  body: string;
  createdAt: Date;
  id: string;
  senderId: string;
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
  const otherParticipant = dbConversation.participants.map((participant: any) => participant).find(
    (participant) => participant.userId !== user.id,
  )?.user;
  const otherParticipantIds = dbConversation.participants
    .map((participant) => participant.userId)
    .filter((participantId) => participantId !== user.id);
  const latestMessage = dbConversation.messages.length > 1 
    ? dbConversation.messages[dbConversation.messages.length - 1] // ascending full messages
    : dbConversation.messages[0]; // descending single message

  return {
    context: dbConversation.opportunity?.title ?? "Professional conversation",
    dealHref: dbConversation.proposals?.find((proposal) => proposal.deal)?.deal
      ? `/app/deals/${dbConversation.proposals.find((proposal) => proposal.deal)?.deal?.id}`
      : undefined,
    id: dbConversation.id,
    lastMessage: latestMessage?.body ?? "No messages yet.",
    messages: dbConversation.messages.map(msg => ({
      body: msg.body,
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
    participantId: dbConversation.participants.find(
      (participant) => participant.userId !== user.id,
    )?.userId ?? null,
    participantImageUrl: otherParticipant?.imageUrl ?? otherParticipant?.profile?.profileImageUrl ?? null,
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

async function markConversationRead(
  conversationId: string,
  userId: string,
  messages: DbMessageLike[],
) {
  const unreadMessageIds = messages
    .filter((message) => message.senderId !== userId)
    .map((message) => message.id);

  await getPrisma().$transaction(async (tx) => {
    await tx.conversationParticipant.updateMany({
      where: { conversationId, userId },
      data: { lastReadAt: new Date() },
    });

    if (unreadMessageIds.length) {
      await tx.messageReadReceipt.createMany({
        data: unreadMessageIds.map((messageId) => ({ messageId, userId })),
        skipDuplicates: true,
      });
    }

    await tx.notification.updateMany({
      data: { readAt: new Date() },
      where: {
        OR: [
          { actionUrl: `/app/messages/${conversationId}` },
          { actionUrl: { startsWith: `/app/messages/${conversationId}?` } },
        ],
        readAt: null,
        type: { in: ["MESSAGE", "NEW_MESSAGE"] },
        userId,
      },
    });
  });
}

export default async function ConversationPage({
  params,
  searchParams,
}: {
  params: Promise<{ conversationId: string }>;
  searchParams: Promise<{ message?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const { conversationId } = await params;
  const { message: highlightMessageId } = await searchParams;
  const conversations = await getConversations(user.id);
  const selected = conversations.find(
    (conversation) => conversation.id === conversationId,
  );
  if (!selected) notFound();

  // Load the full message history for the active conversation
  const { getConversationMessages } = await import("@/lib/data/app");
  const fullMessages = await getConversationMessages(conversationId);
  (selected as DbConversationLike).messages = fullMessages;
  await markConversationRead(conversationId, user.id, fullMessages);

  const workspaceConversations: WorkspaceConversation[] = conversations.map(
    (conversation) => toWorkspaceConversation(conversation, user),
  );

  return (
    <MessageWorkspace
      backHref="/app/messages"
      conversations={workspaceConversations}
      currentUserId={user.id}
      defaultConversationId={conversationId}
      highlightMessageId={highlightMessageId}
    />
  );
}

function toWorkspaceReply(replyTo: any) {
  if (!replyTo) return null;
  return {
    body: replyTo.deletedAt ? "" : replyTo.body,
    deletedAt: replyTo.deletedAt ? replyTo.deletedAt.toISOString?.() ?? String(replyTo.deletedAt) : null,
    id: replyTo.id,
    senderId: replyTo.senderId,
    senderName: replyTo.sender?.name ?? replyTo.sender?.username ?? "Participant",
  };
}
