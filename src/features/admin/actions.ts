"use server";

import { revalidatePath } from "next/cache";

import { requireCapability } from "@/lib/auth/session";
import { getPrisma } from "@/lib/db/prisma";
import { writeAuditLog } from "@/lib/logging/audit";

function textValue(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export async function recordConversationReviewAction(formData: FormData) {
  const admin = await requireCapability("messages:moderate");
  const conversationId = textValue(formData, "conversationId");
  const reason = textValue(formData, "reason");
  const outcome = textValue(formData, "outcome") || "metadata-reviewed";

  if (!conversationId || reason.length < 12) {
    throw new Error("A conversation and a clear moderation reason are required.");
  }

  await getPrisma().moderationAction.create({
    data: {
      action: outcome,
      actorId: admin.id,
      entityId: conversationId,
      entityType: "conversation",
      reason,
    },
  });

  await writeAuditLog({
    actorId: admin.id,
    action: "admin.messages.review_recorded",
    entityId: conversationId,
    entityType: "conversation",
    metadata: { outcome, reasonProvided: true },
  });

  revalidatePath("/admin/messages");
}
