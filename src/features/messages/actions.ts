"use server";

import crypto from "node:crypto";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/lib/auth/session";
import { assertCanMessage } from "@/lib/account/enforcement";
import { getPrisma } from "@/lib/db/prisma";
import { getServerEnv, hasDatabaseUrl, getResolvedDataMode } from "@/lib/env";
import { writeAuditLog } from "@/lib/logging/audit";
import { evaluatePolicy, isPolicyBlocking } from "@/lib/policy/enforcement";

const sendMessageSchema = z.object({
  conversationId: z.string().cuid(),
  body: z.string().trim().min(1, "Message cannot be empty.").max(2000, "Message is too long."),
  replyToMessageId: z.string().cuid().optional().nullable(),
});

const editMessageSchema = z.object({
  body: z.string().trim().min(1, "Message cannot be empty.").max(2000, "Message is too long."),
  messageId: z.string().cuid(),
});

const rateLimitWindowMs = 60_000;
const rateLimitMaxMessages = 20;

function hashMessageBody(body: string) {
  return crypto.createHash("sha256").update(body).digest("hex");
}

export async function sendMessageAction(
  conversationId: string,
  body: string,
  replyToMessageId?: string | null,
) {
  const user = await requireUser();
  const parsed = sendMessageSchema.safeParse({ conversationId, body, replyToMessageId });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid message." };
  }

  const restriction = await assertCanMessage(user.id);
  if (restriction) return { error: restriction };

  if (getResolvedDataMode() === "mock") {
    return { success: true, message: "Sent in mock mode." };
  }

  if (!hasDatabaseUrl()) {
    throw new Error("Database not configured.");
  }

  try {
    const conversation = await getPrisma().conversation.findFirst({
      include: { participants: true },
      where: {
        id: parsed.data.conversationId,
        participants: { some: { userId: user.id } },
        status: "ACTIVE",
      },
    });

    if (!conversation) {
      return { error: "You are not a participant in this conversation." };
    }

    const otherParticipantIds = conversation.participants
      .map((participant) => participant.userId)
      .filter((participantId) => participantId !== user.id);

    const [blocked, recentMessages, duplicate] = await Promise.all([
      getPrisma().blockedUser.findFirst({
        where: {
          OR: otherParticipantIds.flatMap((participantId) => [
            { blockerUserId: user.id, blockedUserId: participantId },
            { blockerUserId: participantId, blockedUserId: user.id },
          ]),
        },
      }),
      getPrisma().message.count({
        where: {
          createdAt: { gte: new Date(Date.now() - rateLimitWindowMs) },
          senderId: user.id,
        },
      }),
      getPrisma().message.findFirst({
        where: {
          body: parsed.data.body.trim(),
          conversationId: parsed.data.conversationId,
          createdAt: { gte: new Date(Date.now() - 5_000) },
          senderId: user.id,
        },
      }),
    ]);

    if (blocked) return { error: "Messaging is unavailable." };
    if (!conversation.opportunityId && conversation.participants.length === 2) {
      const [otherParticipantId] = otherParticipantIds;
      const acceptedConnection = otherParticipantId
        ? await getPrisma().connection.findFirst({
            select: { id: true },
            where: {
              status: "ACCEPTED",
              OR: [
                { requesterId: user.id, receiverId: otherParticipantId },
                { requesterId: otherParticipantId, receiverId: user.id },
              ],
            },
          })
        : null;
      if (!acceptedConnection) {
        return { error: "Connect before sending a private message." };
      }
    }
    if (recentMessages >= rateLimitMaxMessages) {
      return { error: "Please slow down before sending more messages." };
    }
    if (duplicate) return { success: true };

    let replyTarget: { id: string } | null = null;
    if (parsed.data.replyToMessageId) {
      replyTarget = await getPrisma().message.findFirst({
        select: { id: true },
        where: {
          conversationId: parsed.data.conversationId,
          id: parsed.data.replyToMessageId,
        },
      });

      if (!replyTarget) {
        return { error: "The message you are replying to is unavailable." };
      }
    }

    const policy = evaluatePolicy({
      actorId: user.id,
      content: parsed.data.body,
      entityId: parsed.data.conversationId,
      entityType: "message",
    });

    if (policy.outcome !== "ALLOW") {
      await writeAuditLog({
        actorId: user.id,
        action: "policy.message_evaluated",
        entityId: parsed.data.conversationId,
        entityType: "conversation",
        metadata: policy.auditMetadata,
      });
    }

    if (isPolicyBlocking(policy)) {
      return {
        error:
          policy.userMessage ??
          "This message needs review before it can be sent.",
      };
    }

    let createdMessageId = "";

    await getPrisma().$transaction(async (tx) => {
      const message = await tx.message.create({
        data: {
          body: parsed.data.body.trim(),
          conversationId: parsed.data.conversationId,
          replyToMessageId: replyTarget?.id ?? null,
          senderId: user.id,
        },
      });
      createdMessageId = message.id;

      await tx.conversation.update({
        where: { id: parsed.data.conversationId },
        data: { updatedAt: new Date() },
      });

      await tx.messageReadReceipt.create({
        data: { messageId: message.id, userId: user.id },
      });

      await tx.conversationParticipant.updateMany({
        data: { lastReadAt: message.createdAt },
        where: { conversationId: parsed.data.conversationId, userId: user.id },
      });

      await tx.notification.createMany({
        data: otherParticipantIds.map((participantId) => ({
          actionUrl: `/app/messages/${parsed.data.conversationId}?message=${message.id}`,
          body: `${user.name} sent you a message.`,
          metadata: {
            conversationId: parsed.data.conversationId,
            messageId: message.id,
            recipientId: participantId,
            senderId: user.id,
          },
          title: "New message",
          type: "NEW_MESSAGE" as const,
          userId: participantId,
        })),
      });
    });

    revalidatePath("/app/messages");
    revalidatePath(`/app/messages/${parsed.data.conversationId}`);
    revalidatePath("/app/notifications");
    return { messageId: createdMessageId, success: true };
  } catch (error) {
    console.error("Failed to send message:", error);
    return { error: "Failed to send message." };
  }
}

export async function editMessageAction(messageId: string, body: string) {
  const user = await requireUser();
  const restriction = await assertCanMessage(user.id);
  if (restriction) return { error: restriction };

  if (getResolvedDataMode() === "mock") {
    return { success: true };
  }

  const parsed = editMessageSchema.safeParse({ body, messageId });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid message." };
  }

  const message = await getPrisma().message.findFirst({
    include: {
      conversation: {
        include: { participants: true },
      },
    },
    where: {
      id: parsed.data.messageId,
      conversation: { participants: { some: { userId: user.id } } },
    },
  });

  if (!message || message.senderId !== user.id) {
    return { error: "You can only edit your own messages." };
  }
  if (message.deletedAt) {
    return { error: "Deleted messages cannot be edited." };
  }

  const editWindowMs = getServerEnv().MESSAGE_EDIT_WINDOW_MINUTES * 60_000;
  if (Date.now() - message.createdAt.getTime() > editWindowMs) {
    return { error: "The edit window for this message has closed." };
  }

  const nextBody = parsed.data.body.trim();
  if (nextBody === message.body) return { success: true };

  const policy = evaluatePolicy({
    actorId: user.id,
    content: nextBody,
    entityId: message.id,
    entityType: "message",
  });

  if (policy.outcome !== "ALLOW") {
    await writeAuditLog({
      actorId: user.id,
      action: "policy.message_edit_evaluated",
      entityId: message.id,
      entityType: "message",
      metadata: policy.auditMetadata,
    });
  }

  if (isPolicyBlocking(policy)) {
    return {
      error:
        policy.userMessage ??
        "This edit needs review before it can be saved.",
    };
  }

  await getPrisma().$transaction(async (tx) => {
    await tx.message.update({
      data: { body: nextBody, editedAt: new Date() },
      where: { id: message.id },
    });
    await tx.messageEdit.create({
      data: {
        editorId: user.id,
        messageId: message.id,
        nextBodyHash: hashMessageBody(nextBody),
        previousBodyHash: hashMessageBody(message.body),
      },
    });
    await tx.auditLog.create({
      data: {
        action: "message.edited",
        actorId: user.id,
        entityId: message.id,
        entityType: "message",
        metadata: {
          bodyChanged: true,
          conversationId: message.conversationId,
          policyOutcome: policy.outcome,
        },
      },
    });
  });

  revalidatePath("/app/messages");
  revalidatePath(`/app/messages/${message.conversationId}`);
  return { success: true };
}

export async function markConversationReadAction(conversationId: string) {
  const user = await requireUser();
  const parsed = z.string().cuid().safeParse(conversationId);
  if (!parsed.success) return { error: "Invalid conversation." };

  const participant = await getPrisma().conversationParticipant.findUnique({
    select: { id: true },
    where: {
      conversationId_userId: {
        conversationId: parsed.data,
        userId: user.id,
      },
    },
  });

  if (!participant) return { error: "Conversation not found." };

  const unreadMessages = await getPrisma().message.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true },
    take: 100,
    where: {
      conversationId: parsed.data,
      senderId: { not: user.id },
      readReceipts: { none: { userId: user.id } },
    },
  });

  await getPrisma().$transaction(async (tx) => {
    await tx.conversationParticipant.update({
      data: { lastReadAt: new Date() },
      where: {
        conversationId_userId: {
          conversationId: parsed.data,
          userId: user.id,
        },
      },
    });

    if (unreadMessages.length) {
      await tx.messageReadReceipt.createMany({
        data: unreadMessages.map((message) => ({
          messageId: message.id,
          userId: user.id,
        })),
        skipDuplicates: true,
      });
    }

    await tx.notification.updateMany({
      data: { readAt: new Date() },
      where: {
        OR: [
          { actionUrl: `/app/messages/${parsed.data}` },
          { actionUrl: { startsWith: `/app/messages/${parsed.data}?` } },
        ],
        readAt: null,
        type: { in: ["MESSAGE", "MESSAGE_REQUEST_RECEIVED", "NEW_MESSAGE"] },
        userId: user.id,
      },
    });
  });

  revalidatePath("/app/messages");
  revalidatePath(`/app/messages/${parsed.data}`);
  revalidatePath("/app/notifications");
  return { success: true };
}
