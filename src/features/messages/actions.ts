"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/lib/auth/session";
import { getPrisma } from "@/lib/db/prisma";
import { hasDatabaseUrl, getResolvedDataMode } from "@/lib/env";
import { writeAuditLog } from "@/lib/logging/audit";
import { evaluatePolicy, isPolicyBlocking } from "@/lib/policy/enforcement";

const sendMessageSchema = z.object({
  conversationId: z.string().cuid(),
  body: z.string().trim().min(1, "Message cannot be empty.").max(2000, "Message is too long."),
});

const rateLimitWindowMs = 60_000;
const rateLimitMaxMessages = 20;

export async function sendMessageAction(conversationId: string, body: string) {
  const user = await requireUser();

  if (getResolvedDataMode() === "mock") {
    return { success: true, message: "Sent in mock mode." };
  }

  if (!hasDatabaseUrl()) {
    throw new Error("Database not configured.");
  }

  const parsed = sendMessageSchema.safeParse({ conversationId, body });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid message." };
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
    if (recentMessages >= rateLimitMaxMessages) {
      return { error: "Please slow down before sending more messages." };
    }
    if (duplicate) return { success: true };

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

    await getPrisma().$transaction(async (tx) => {
      const message = await tx.message.create({
        data: {
          body: parsed.data.body.trim(),
          conversationId: parsed.data.conversationId,
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

      await tx.notification.createMany({
        data: otherParticipantIds.map((participantId) => ({
          body: `${user.name} sent you a message.`,
          title: "New message",
          type: "MESSAGE" as const,
          userId: participantId,
        })),
      });
    });

    revalidatePath("/app/messages");
    revalidatePath(`/app/messages/${parsed.data.conversationId}`);
    return { success: true };
  } catch (error) {
    console.error("Failed to send message:", error);
    return { error: "Failed to send message." };
  }
}
