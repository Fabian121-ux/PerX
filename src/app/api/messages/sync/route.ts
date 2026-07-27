import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { getPrisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const url = new URL(request.url);
  const conversationId = url.searchParams.get("conversationId");
  const prisma = getPrisma();

  if (conversationId) {
    const participant = await prisma.conversationParticipant.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId: user.id,
        },
      },
    });
    if (!participant) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
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
          sender: { select: { id: true, imageUrl: true, name: true, username: true } },
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
                  trustScore: true,
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
    },
    orderBy: { updatedAt: "desc" },
    take: 50,
    where: {
      participants: { some: { userId: user.id } },
      status: "ACTIVE",
    },
  });

  return NextResponse.json({
    conversations: conversations.map((conversation) => {
      const participant = conversation.participants.find(
        (entry) => entry.userId === user.id,
      );
      const other = conversation.participants.find(
        (entry) => entry.userId !== user.id,
      )?.user;
      const otherParticipantIds = conversation.participants
        .map((entry) => entry.userId)
        .filter((participantId) => participantId !== user.id);
      const messages = [...conversation.messages].reverse();
      const unreadCount = conversation.messages.filter(
        (message) =>
          message.senderId !== user.id &&
          (!participant?.lastReadAt || message.createdAt > participant.lastReadAt),
      ).length;

      return {
        context: conversation.opportunity?.title ?? "Professional conversation",
        id: conversation.id,
        lastMessage: conversation.messages[0]?.body ?? "No messages yet.",
        messages: messages.map((message) => ({
          body: message.body,
          createdAt: message.createdAt.toISOString(),
          deletedAt: message.deletedAt?.toISOString() ?? null,
          editedAt: message.editedAt?.toISOString() ?? null,
          id: message.id,
          readByCurrentUser: message.readReceipts.some(
            (receipt) => receipt.userId === user.id,
          ),
          readByOtherParticipants:
            otherParticipantIds.length > 0 &&
            otherParticipantIds.every((participantId) =>
              message.readReceipts.some((receipt) => receipt.userId === participantId),
            ),
          replyTo: message.replyTo
            ? {
                body: message.replyTo.deletedAt ? "" : message.replyTo.body,
                deletedAt: message.replyTo.deletedAt?.toISOString() ?? null,
                id: message.replyTo.id,
                senderId: message.replyTo.senderId,
                senderName: message.replyTo.sender.name ?? message.replyTo.sender.username ?? "Participant",
              }
            : null,
          senderId: message.senderId,
          senderImageUrl:
            message.sender.imageUrl ?? null,
          senderName: message.sender.name,
        })),
        opportunityTitle: conversation.opportunity?.title ?? null,
        participantImageUrl: other?.imageUrl ?? other?.profile?.profileImageUrl ?? null,
        participantName: other?.name ?? "Conversation",
        participantPresence: getPresenceState(
          other?.profile?.showPresence ?? false,
          other?.sessions[0]?.lastSeenAt ?? null,
        ),
        participantUsername: other?.username ?? null,
        timestamp:
          conversation.messages[0]?.createdAt.toISOString() ??
          conversation.updatedAt.toISOString(),
        trustScore: other?.profile?.trustScore ?? null,
        unreadCount,
      };
    }),
  });
}

function getPresenceState(showPresence: boolean, lastSeenAt: Date | null) {
  if (!showPresence || !lastSeenAt) return "hidden";
  const ageMs = Date.now() - lastSeenAt.getTime();
  if (ageMs <= 2 * 60_000) return "online";
  if (ageMs <= 30 * 60_000) return "recent";
  return "offline";
}
