"use server";

import crypto from "node:crypto";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentSessionTokenHash, requireUser } from "@/lib/auth/session";
import {
  assertAccountAccessWithClient,
  assertCanMessage,
} from "@/lib/account/enforcement";
import { getPrisma } from "@/lib/db/prisma";
import { getServerEnv, hasDatabaseUrl, getResolvedDataMode } from "@/lib/env";
import { writeAuditLog } from "@/lib/logging/audit";
import { parseMessageRouteId } from "@/lib/messages/entry";
import { messageMutationTransactionTimeoutMs } from "@/lib/messages/mutations";
import { markConversationReadForUser } from "@/lib/messages/read-state";
import { lockUserAccount, lockUserPairs } from "@/lib/network/pair-lock";
import { evaluatePolicy, isPolicyBlocking } from "@/lib/policy/enforcement";

const sendMessageSchema = z.object({
  conversationId: z.string().cuid(),
  body: z
    .string()
    .trim()
    .min(1, "Message cannot be empty.")
    .max(2000, "Message is too long."),
  replyToMessageId: z.string().cuid().optional().nullable(),
});

const editMessageSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, "Message cannot be empty.")
    .max(2000, "Message is too long."),
  messageId: z.string().cuid(),
});

const messageIdSchema = z.string().cuid("Invalid message.");
const conversationIdSchema = z.string().cuid("Invalid conversation.");

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
  const sessionTokenHash = await getCurrentSessionTokenHash();
  if (!sessionTokenHash) return { error: "Authentication required." };
  const parsed = sendMessageSchema.safeParse({
    conversationId,
    body,
    replyToMessageId,
  });
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
      select: { id: true },
      where: {
        id: parsed.data.conversationId,
        participants: { some: { removedAt: null, userId: user.id } },
        status: "ACTIVE",
      },
    });

    if (!conversation) {
      return { error: "You are not a participant in this conversation." };
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

    const result = await getPrisma().$transaction(
      async (tx) => {
        const currentConversation = await tx.conversation.findFirst({
          include: { participants: true },
          where: {
            id: parsed.data.conversationId,
            participants: { some: { removedAt: null, userId: user.id } },
            status: "ACTIVE",
          },
        });
        if (!currentConversation) {
          return { error: "You are not a participant in this conversation." };
        }
        const otherParticipantIds = currentConversation.participants
          .map((participant) => participant.userId)
          .filter((participantId) => participantId !== user.id);
        if (!otherParticipantIds.length) {
          return { error: "Messaging is unavailable." };
        }

        await lockUserAccount(tx, user.id);
        await lockUserPairs(tx, user.id, otherParticipantIds);
        const activeSession = await tx.session.findFirst({
          select: { id: true },
          where: {
            expiresAt: { gt: new Date() },
            tokenHash: sessionTokenHash,
            userId: user.id,
          },
        });
        if (!activeSession) {
          return { error: "Authentication required." };
        }
        const lockedRestriction = await assertAccountAccessWithClient(
          tx,
          user.id,
          "message:send",
        );
        if (lockedRestriction) return { error: lockedRestriction };
        const [blocked, recentMessages, duplicate] = await Promise.all([
          tx.blockedUser.findFirst({
            select: { id: true },
            where: {
              OR: otherParticipantIds.flatMap((participantId) => [
                { blockerUserId: user.id, blockedUserId: participantId },
                { blockerUserId: participantId, blockedUserId: user.id },
              ]),
            },
          }),
          tx.message.count({
            where: {
              createdAt: { gte: new Date(Date.now() - rateLimitWindowMs) },
              senderId: user.id,
            },
          }),
          tx.message.findFirst({
            select: { id: true },
            where: {
              body: parsed.data.body.trim(),
              conversationId: parsed.data.conversationId,
              createdAt: { gte: new Date(Date.now() - 5_000) },
              replyToMessageId: parsed.data.replyToMessageId ?? null,
              senderId: user.id,
            },
          }),
        ]);
        if (blocked) return { error: "Messaging is unavailable." };
        if (recentMessages >= rateLimitMaxMessages) {
          return { error: "Please slow down before sending more messages." };
        }
        if (duplicate) return { duplicate: true };

        if (
          !currentConversation.opportunityId &&
          currentConversation.participants.length === 2
        ) {
          const [otherParticipantId] = otherParticipantIds;
          const acceptedConnection = otherParticipantId
            ? await tx.connection.findFirst({
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

        const replyTarget = parsed.data.replyToMessageId
          ? await tx.message.findFirst({
              select: { id: true },
              where: {
                conversationId: parsed.data.conversationId,
                id: parsed.data.replyToMessageId,
              },
            })
          : null;
        if (parsed.data.replyToMessageId && !replyTarget) {
          return { error: "The message you are replying to is unavailable." };
        }

        const message = await tx.message.create({
          data: {
            body: parsed.data.body.trim(),
            conversationId: parsed.data.conversationId,
            replyToMessageId: replyTarget?.id ?? null,
            senderId: user.id,
          },
        });

        await tx.conversation.update({
          where: { id: parsed.data.conversationId },
          data: { updatedAt: new Date() },
        });

        await tx.messageReadReceipt.create({
          data: { messageId: message.id, userId: user.id },
        });

        await tx.conversationParticipant.updateMany({
          data: { removedAt: null },
          where: {
            conversationId: parsed.data.conversationId,
            removedAt: { not: null },
          },
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
        return { messageId: message.id };
      },
      { timeout: 10_000 },
    );

    if ("error" in result) return { error: result.error };
    if ("duplicate" in result) return { success: true };

    revalidatePath("/app/messages");
    revalidatePath(`/app/messages/${parsed.data.conversationId}`);
    revalidatePath("/app/notifications");
    return { messageId: result.messageId, success: true };
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
        policy.userMessage ?? "This edit needs review before it can be saved.",
    };
  }

  await getPrisma().$transaction(
    async (tx) => {
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
    },
    { timeout: messageMutationTransactionTimeoutMs },
  );

  revalidatePath("/app/messages");
  revalidatePath(`/app/messages/${message.conversationId}`);
  return { success: true };
}

export async function deleteMessageAction(messageId: string) {
  const user = await requireUser();
  const parsed = messageIdSchema.safeParse(messageId);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  if (getResolvedDataMode() === "mock") return { success: true };
  if (!hasDatabaseUrl()) return { error: "Database not configured." };

  const message = await getPrisma().message.findFirst({
    select: {
      conversationId: true,
      createdAt: true,
      deletedAt: true,
      senderId: true,
    },
    where: {
      id: parsed.data,
      conversation: {
        participants: { some: { userId: user.id } },
        status: "ACTIVE",
      },
    },
  });

  if (!message || message.senderId !== user.id) {
    return { error: "You can only remove your own messages." };
  }
  if (message.deletedAt) return { success: true };

  const editWindowMs = getServerEnv().MESSAGE_EDIT_WINDOW_MINUTES * 60_000;
  if (Date.now() - message.createdAt.getTime() > editWindowMs) {
    return { error: "The removal window for this message has closed." };
  }

  await getPrisma().$transaction(
    async (tx) => {
      const updated = await tx.message.updateMany({
        data: { deletedAt: new Date(), deletedById: user.id },
        where: { deletedAt: null, id: parsed.data, senderId: user.id },
      });
      if (!updated.count) return;
      await tx.auditLog.create({
        data: {
          action: "message.deleted",
          actorId: user.id,
          entityId: parsed.data,
          entityType: "message",
          metadata: {
            conversationId: message.conversationId,
            retainedAsTombstone: true,
          },
        },
      });
    },
    { timeout: messageMutationTransactionTimeoutMs },
  );

  revalidatePath("/app/messages");
  revalidatePath(`/app/messages/${message.conversationId}`);
  return { success: true };
}

export async function removeConversationForMeAction(conversationId: string) {
  const user = await requireUser();
  const parsed = conversationIdSchema.safeParse(conversationId);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  if (getResolvedDataMode() === "mock") return { success: true };
  if (!hasDatabaseUrl()) return { error: "Database not configured." };

  const removed = await getPrisma().$transaction(async (tx) => {
    const updated = await tx.conversationParticipant.updateMany({
      data: { removedAt: new Date() },
      where: { conversationId: parsed.data, userId: user.id },
    });
    if (!updated.count) return false;
    await tx.auditLog.create({
      data: {
        action: "conversation.removed_for_participant",
        actorId: user.id,
        entityId: parsed.data,
        entityType: "conversation",
        metadata: { participantLocal: true },
      },
    });
    return true;
  });
  if (!removed) return { error: "Conversation not found." };

  revalidatePath("/app/messages");
  return { success: true };
}

export async function markConversationReadAction(
  conversationId: string,
  throughEntryId?: string,
  throughEntryKind?: "event" | "message",
) {
  const user = await requireUser();
  const parsed = z.string().cuid().safeParse(conversationId);
  if (!parsed.success) return { error: "Invalid conversation." };
  const hasReadMarker = Boolean(throughEntryId || throughEntryKind);
  const parsedEntryId = throughEntryId
    ? parseMessageRouteId(throughEntryId)
    : null;
  if (
    hasReadMarker &&
    (!parsedEntryId ||
      (throughEntryKind !== "event" && throughEntryKind !== "message"))
  ) {
    return { error: "Invalid read marker." };
  }

  const marked = await markConversationReadForUser(
    parsed.data,
    user.id,
    parsedEntryId && throughEntryKind
      ? { id: parsedEntryId, kind: throughEntryKind }
      : null,
  );
  if (!marked) return { error: "Conversation not found." };

  revalidatePath("/app/messages");
  revalidatePath("/app/notifications");
  return { success: true };
}
