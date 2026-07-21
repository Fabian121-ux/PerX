"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/lib/auth/session";
import { getPrisma } from "@/lib/db/prisma";
import { hasDatabaseUrl, getResolvedDataMode } from "@/lib/env";

const sendMessageSchema = z.object({
  conversationId: z.string().cuid(),
  body: z.string().trim().min(1, "Message cannot be empty.").max(2000, "Message is too long."),
});

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
    // Verify participation
    const participation = await getPrisma().conversationParticipant.findUnique({
      where: {
        conversationId_userId: {
          conversationId: parsed.data.conversationId,
          userId: user.id,
        },
      },
    });

    if (!participation) {
      return { error: "You are not a participant in this conversation." };
    }

    await getPrisma().$transaction(async (tx) => {
      await tx.message.create({
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
    });

    revalidatePath("/app/messages");
    revalidatePath(`/app/messages/${parsed.data.conversationId}`);
    return { success: true };
  } catch (error) {
    console.error("Failed to send message:", error);
    return { error: "Failed to send message." };
  }
}
