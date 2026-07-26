"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireCapabilityOrNotFound } from "@/lib/auth/session";
import { getPrisma } from "@/lib/db/prisma";
import { writeAuditLog } from "@/lib/logging/audit";
import { normalizeNotificationActionUrl } from "@/lib/notifications/action-url";

function textValue(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

const broadcastSchema = z.object({
  actionUrl: z.string().trim().optional(),
  audience: z.enum([
    "ALL_ACTIVE_USERS",
    "PUBLIC_BETA_USERS",
    "INTERNAL_TEST_USERS",
    "ADMINISTRATORS",
  ]),
  body: z.string().trim().min(10).max(1000),
  expiresAt: z.string().trim().optional(),
  priority: z.enum(["NORMAL", "HIGH"]).default("NORMAL"),
  title: z.string().trim().min(4).max(120),
});

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

export async function sendAdminBroadcastAction(formData: FormData) {
  const admin = await requireCapabilityOrNotFound("broadcasts:create");
  const parsed = broadcastSchema.safeParse({
    actionUrl: textValue(formData, "actionUrl"),
    audience: textValue(formData, "audience"),
    body: textValue(formData, "body"),
    expiresAt: textValue(formData, "expiresAt"),
    priority: textValue(formData, "priority") || "NORMAL",
    title: textValue(formData, "title"),
  });

  if (!parsed.success) {
    throw new Error("Please check the broadcast fields.");
  }

  const actionUrl = parsed.data.actionUrl
    ? normalizeNotificationActionUrl(parsed.data.actionUrl)
    : null;
  if (parsed.data.actionUrl && !actionUrl) {
    throw new Error("Broadcast action URL must be a safe internal path.");
  }

  const expiresAt = parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null;
  if (expiresAt && Number.isNaN(expiresAt.getTime())) {
    throw new Error("Broadcast expiry is invalid.");
  }

  const audienceWhere =
    parsed.data.audience === "PUBLIC_BETA_USERS"
      ? { accountClassification: "PUBLIC_BETA_USER" as const, isActive: true }
      : parsed.data.audience === "INTERNAL_TEST_USERS"
        ? { accountClassification: "INTERNAL_TEST_USER" as const, isActive: true }
        : parsed.data.audience === "ADMINISTRATORS"
          ? { isActive: true, roles: { some: { role: { name: "ADMIN" as const } } } }
          : { isActive: true };

  const recipients = await getPrisma().user.findMany({
    select: { id: true },
    take: 500,
    where: audienceWhere,
  });

  const result = await getPrisma().$transaction(async (tx) => {
    const broadcast = await tx.adminBroadcast.create({
      data: {
        actionUrl,
        audience: parsed.data.audience,
        body: parsed.data.body,
        expiresAt,
        priority: parsed.data.priority,
        senderId: admin.id,
        sentAt: new Date(),
        title: parsed.data.title,
      },
    });

    const notificationResult = recipients.length
      ? await tx.notification.createMany({
          data: recipients.map((recipient) => ({
            actionUrl: actionUrl ?? "/app/notifications",
            broadcastId: broadcast.id,
            body: parsed.data.body,
            metadata: {
              audience: parsed.data.audience,
              broadcastId: broadcast.id,
              priority: parsed.data.priority,
            },
            title: parsed.data.title,
            type: "BROADCAST" as const,
            userId: recipient.id,
          })),
          skipDuplicates: true,
        })
      : { count: 0 };

    if (recipients.length) {
      await tx.broadcastDelivery.createMany({
        data: recipients.map((recipient) => ({
          broadcastId: broadcast.id,
          status: "SENT",
          userId: recipient.id,
        })),
        skipDuplicates: true,
      });
    }

    await tx.adminBroadcast.update({
      data: {
        deliveryCount: notificationResult.count,
        failedCount: Math.max(0, recipients.length - notificationResult.count),
      },
      where: { id: broadcast.id },
    });

    await tx.auditLog.create({
      data: {
        action: "admin.broadcast.sent",
        actorId: admin.id,
        entityId: broadcast.id,
        entityType: "adminBroadcast",
        metadata: {
          audience: parsed.data.audience,
          deliveryCount: notificationResult.count,
          failedCount: Math.max(0, recipients.length - notificationResult.count),
          hasActionUrl: Boolean(actionUrl),
        },
      },
    });

    return { broadcastId: broadcast.id, deliveryCount: notificationResult.count };
  });

  await writeAuditLog({
    actorId: admin.id,
    action: "admin.broadcast.completed",
    entityId: result.broadcastId,
    entityType: "adminBroadcast",
    metadata: { deliveryCount: result.deliveryCount },
  });

  revalidatePath("/admin/broadcasts");
  revalidatePath("/app/notifications");
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
