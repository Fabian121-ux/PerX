/* eslint-disable @typescript-eslint/no-explicit-any */
import { notFound, redirect } from "next/navigation";

import {
  MessageWorkspace,
  type WorkspaceConversation,
} from "@/components/messages/message-workspace";
import { getCurrentUser, type CurrentUser } from "@/lib/auth/session";
import { getConversationMessages, getConversations } from "@/lib/data/app";
import { getPrisma } from "@/lib/db/prisma";
import { findOwnedMessageTarget } from "@/lib/messages/entry";
import { markConversationReadForUser } from "@/lib/messages/read-state";

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

  const exactTarget = highlightMessageId
    ? await findOwnedMessageTarget(user.id, {
        conversationId,
        messageId: highlightMessageId,
      })
    : null;
  if (highlightMessageId && !exactTarget) notFound();

  let fullMessages = await getConversationMessages(conversationId);
  if (
    exactTarget &&
    !fullMessages.some((message) => message.id === exactTarget.id)
  ) {
    const targetMessage = await getPrisma().message.findFirst({
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
        sender: true,
      },
      where: {
        conversationId,
        deletedAt: null,
        id: exactTarget.id,
      },
    });
    if (!targetMessage) notFound();
    fullMessages = [...fullMessages, targetMessage].sort((a, b) => {
      const timeDifference = a.createdAt.getTime() - b.createdAt.getTime();
      return timeDifference || a.id.localeCompare(b.id);
    });
  }

  (selected as DbConversationLike).messages = fullMessages;
  await markConversationReadForUser(conversationId, user.id);

  const workspaceConversations: WorkspaceConversation[] = conversations.map(
    (conversation) => toWorkspaceConversation(conversation, user),
  );

  return (
    <MessageWorkspace
      backHref="/app/messages"
      conversations={workspaceConversations}
      currentUserId={user.id}
      defaultConversationId={conversationId}
      highlightMessageId={exactTarget?.id}
      key={`${conversationId}:${exactTarget?.id ?? "latest"}`}
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
