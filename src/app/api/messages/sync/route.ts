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
              profile: { select: { profileImageUrl: true, trustScore: true } },
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
          id: message.id,
          readByCurrentUser: message.readReceipts.some(
            (receipt) => receipt.userId === user.id,
          ),
          senderId: message.senderId,
          senderImageUrl:
            message.sender.imageUrl ?? null,
          senderName: message.sender.name,
        })),
        opportunityTitle: conversation.opportunity?.title ?? null,
        participantImageUrl: other?.imageUrl ?? other?.profile?.profileImageUrl ?? null,
        participantName: other?.name ?? "Conversation",
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
