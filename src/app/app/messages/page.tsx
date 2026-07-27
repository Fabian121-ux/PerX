/* eslint-disable @typescript-eslint/no-explicit-any */
import { redirect } from "next/navigation";

import { MessageWorkspace, type WorkspaceConversation } from "@/components/messages/message-workspace";
import { getCurrentUser, type CurrentUser } from "@/lib/auth/session";
import { getConversations } from "@/lib/data/app";

type PreviewConversationLike = {
  id: string;
  lastMessage?: string;
  messages: { body: string; createdAt: string; id: string; senderId: string; senderName: string }[];
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
    lastReadAt?: Date | null;
  }[];
};

function getPresenceState(showPresence: boolean, lastSeenAt?: Date | null) {
  if (!showPresence || !lastSeenAt) return "hidden";
  const ageMs = Date.now() - lastSeenAt.getTime();
  if (ageMs <= 2 * 60_000) return "online";
  if (ageMs <= 30 * 60_000) return "recent";
  return "offline";
}

function isPreviewConversation(conversation: unknown): conversation is PreviewConversationLike {
  return (
    Boolean(conversation) &&
    typeof conversation === "object" &&
    typeof (conversation as { participantName?: unknown }).participantName === "string" &&
    Array.isArray((conversation as { messages?: unknown }).messages)
  );
}

function toWorkspaceConversation(conversation: unknown, user: CurrentUser): WorkspaceConversation {
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
      trustScore: 86,
      unreadCount: 1,
    };
  }

  const dbConversation = conversation as DbConversationLike;
  const currentParticipant = dbConversation.participants.find((participant) => participant.userId === user.id);
  const otherParticipant = dbConversation.participants.find((participant) => participant.userId !== user.id)?.user;
  const otherParticipantIds = dbConversation.participants
    .map((participant) => participant.userId)
    .filter((participantId) => participantId !== user.id);
  const latestMessage = dbConversation.messages[0];
  const unreadCount =
    latestMessage &&
    latestMessage.senderId !== user.id &&
    (!currentParticipant?.lastReadAt || latestMessage.createdAt > currentParticipant.lastReadAt)
      ? 1
      : 0;

  return {
    context: dbConversation.opportunity?.title ?? "Professional conversation",
    id: dbConversation.id,
    lastMessage: latestMessage?.body ?? "No messages yet.",
    messages: latestMessage
      ? [
          {
            body: latestMessage.body,
            createdAt: latestMessage.createdAt.toISOString(),
            deletedAt: latestMessage.deletedAt?.toISOString() ?? null,
            editedAt: latestMessage.editedAt?.toISOString() ?? null,
            id: latestMessage.id,
            readByOtherParticipants:
              otherParticipantIds.length > 0 &&
              otherParticipantIds.every((participantId) =>
                latestMessage.readReceipts?.some((receipt) => receipt.userId === participantId),
              ),
            replyTo: toWorkspaceReply((latestMessage as any).replyTo),
            senderId: latestMessage.senderId,
            senderName: latestMessage.senderId === user.id ? user.name : otherParticipant?.name ?? "Participant",
          },
        ]
      : [],
    opportunityTitle: dbConversation.opportunity?.title ?? undefined,
    participantImageUrl: otherParticipant?.imageUrl ?? otherParticipant?.profile?.profileImageUrl ?? null,
    participantName: otherParticipant?.name ?? dbConversation.opportunity?.title ?? "Conversation",
    participantPresence: getPresenceState(
      Boolean(otherParticipant?.profile?.showPresence),
      otherParticipant?.sessions?.[0]?.lastSeenAt ?? null,
    ),
    participantRole: "Opportunity participant",
    participantUsername: otherParticipant?.username ?? undefined,
    timestamp: latestMessage ? latestMessage.createdAt.toLocaleDateString() : "new",
    trustScore: undefined,
    unreadCount,
  };
}

export default async function MessagesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const conversations = await getConversations(user.id);
  const workspaceConversations = conversations.map((conversation: any) => toWorkspaceConversation(conversation, user));

  return <MessageWorkspace conversations={workspaceConversations} currentUserId={user.id} />;
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
