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
  messages: { body: string; createdAt: Date; id: string; senderId: string }[];
  opportunity?: { title: string } | null;
  participants: { user?: { name: string | null; username: string | null } | null; userId: string }[];
};

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
  const otherParticipant = dbConversation.participants.find((participant) => participant.userId !== user.id)?.user;
  const latestMessage = dbConversation.messages[0];

  return {
    context: dbConversation.opportunity?.title ?? "Professional conversation",
    id: dbConversation.id,
    lastMessage: latestMessage?.body ?? "No messages yet.",
    messages: latestMessage
      ? [
          {
            body: latestMessage.body,
            createdAt: latestMessage.createdAt.toISOString(),
            id: latestMessage.id,
            senderId: latestMessage.senderId,
            senderName: latestMessage.senderId === user.id ? user.name : otherParticipant?.name ?? "Participant",
          },
        ]
      : [],
    opportunityTitle: dbConversation.opportunity?.title ?? undefined,
    participantName: otherParticipant?.name ?? dbConversation.opportunity?.title ?? "Conversation",
    participantRole: "Opportunity participant",
    participantUsername: otherParticipant?.username ?? undefined,
    timestamp: latestMessage ? latestMessage.createdAt.toLocaleDateString() : "new",
    trustScore: undefined,
    unreadCount: 0,
  };
}

export default async function MessagesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const conversations = await getConversations(user.id);
  const workspaceConversations = conversations.map((conversation: any) => toWorkspaceConversation(conversation, user));

  return <MessageWorkspace conversations={workspaceConversations} currentUserId={user.id} />;
}
