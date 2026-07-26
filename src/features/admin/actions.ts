"use server";

import { revalidatePath } from "next/cache";

import { requireCapabilityOrNotFound } from "@/lib/auth/session";
import { getPrisma } from "@/lib/db/prisma";
import { writeAuditLog } from "@/lib/logging/audit";

function textValue(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export async function recordConversationReviewAction(formData: FormData) {
  const admin = await requireCapabilityOrNotFound("messages:moderate");
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

export async function reviewPropertyListingAction(formData: FormData) {
  const admin = await requireCapabilityOrNotFound("opportunity:moderate");
  const opportunityId = textValue(formData, "opportunityId");
  const decision = textValue(formData, "decision");
  const reason = textValue(formData, "reason");

  if (!opportunityId || reason.length < 8) {
    throw new Error("A listing and reason are required.");
  }

  const listing = await getPrisma().opportunity.findFirst({
    include: { images: true, owner: { select: { id: true } } },
    where: { id: opportunityId, type: "PROPERTY" },
  });

  if (!listing) {
    throw new Error("Listing not found.");
  }

  const hasCover = listing.images.some((image) => image.isCover);
  if (decision === "approve" && !hasCover) {
    throw new Error("Property listing requires a cover image.");
  }

  const next =
    decision === "approve"
      ? {
          moderationStatus: "APPROVED" as const,
          propertyVerificationState: "PUBLISHED" as const,
          publishedAt: listing.publishedAt ?? new Date(),
          status: "PUBLISHED" as const,
        }
      : decision === "reject"
        ? {
            moderationStatus: "REJECTED" as const,
            propertyVerificationState: "REJECTED" as const,
            status: "DRAFT" as const,
          }
        : decision === "pause"
          ? {
              propertyVerificationState: "PAUSED" as const,
              status: "PAUSED" as const,
            }
          : decision === "restore"
            ? {
                propertyVerificationState: "VERIFIED" as const,
                status: "DRAFT" as const,
              }
            : {
                moderationStatus: "PENDING" as const,
                propertyVerificationState: "PENDING_VERIFICATION" as const,
                status: "DRAFT" as const,
              };

  await getPrisma().$transaction(async (tx) => {
    await tx.opportunity.update({
      data: {
        ...next,
        verificationNotes: reason,
      },
      where: { id: listing.id },
    });
    await tx.moderationAction.create({
      data: {
        action: `property.${decision || "request_info"}`,
        actorId: admin.id,
        entityId: listing.id,
        entityType: "opportunity",
        reason,
      },
    });
    await tx.auditLog.create({
      data: {
        action: "admin.property.review",
        actorId: admin.id,
        entityId: listing.id,
        entityType: "opportunity",
        metadata: {
          decision: decision || "request_info",
          fromModerationStatus: listing.moderationStatus,
          fromStatus: listing.status,
          reasonProvided: true,
        },
      },
    });
    await tx.notification.create({
      data: {
        actionUrl: `/app/opportunities/${listing.id}/edit`,
        body:
          decision === "approve"
            ? "Your property listing review was approved."
            : decision === "reject"
              ? "Your property listing needs changes before it can be public."
              : "Your property listing review was updated.",
        metadata: { opportunityId: listing.id },
        title: "Property listing review",
        type: "MODERATION_UPDATE",
        userId: listing.owner.id,
      },
    });
  });

  revalidatePath("/admin/real-estate");
  revalidatePath("/admin/opportunities");
  revalidatePath("/app/manage");
  revalidatePath("/app/real-estate");
  revalidatePath("/discover");
}
