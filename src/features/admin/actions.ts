"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { Prisma } from "@/generated/prisma/client";
import type {
  EnforcementActionType,
  ModerationCaseStatus,
} from "@/generated/prisma/enums";
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

const caseStatusValues = [
  "NEW",
  "TRIAGED",
  "ASSIGNED",
  "IN_REVIEW",
  "NEEDS_INFORMATION",
  "ACTION_REQUIRED",
  "ESCALATED",
  "RESOLVED",
  "DISMISSED",
  "APPEALED",
  "CLOSED",
] as const;

const enforcementTypeValues = [
  "WARNING",
  "MESSAGING_RESTRICTION",
  "CONNECTION_REQUEST_RESTRICTION",
  "PUBLISHING_RESTRICTION",
  "VERIFICATION_REQUIRED",
  "TEMPORARY_SUSPENSION",
  "INDEFINITE_SUSPENSION",
  "DEACTIVATION",
  "PERMANENT_BAN",
  "SESSION_REVOCATION",
  "RESTORATION",
] as const;

function expiryFromForm(formData: FormData) {
  const duration = textValue(formData, "duration");
  const now = new Date();
  if (duration === "1h") return new Date(now.getTime() + 60 * 60_000);
  if (duration === "24h") return new Date(now.getTime() + 24 * 60 * 60_000);
  if (duration === "3d") return new Date(now.getTime() + 3 * 24 * 60 * 60_000);
  if (duration === "7d") return new Date(now.getTime() + 7 * 24 * 60 * 60_000);
  if (duration === "14d") return new Date(now.getTime() + 14 * 24 * 60 * 60_000);
  if (duration === "30d") return new Date(now.getTime() + 30 * 24 * 60 * 60_000);
  if (duration === "custom") {
    const custom = new Date(textValue(formData, "customExpiry"));
    return Number.isNaN(custom.getTime()) ? null : custom;
  }
  return null;
}

function jsonSafeState(state: Record<string, unknown>): Prisma.InputJsonObject {
  return Object.fromEntries(
    Object.entries(state).map(([key, value]) => [
      key,
      value instanceof Date ? value.toISOString() : value,
    ]),
  ) as Prisma.InputJsonObject;
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

export async function recordMessageScopeRevealAction(formData: FormData) {
  const admin = await requireCapabilityOrNotFound("messages:moderate");
  const caseId = textValue(formData, "caseId");
  const reason = textValue(formData, "reason");
  const scope = textValue(formData, "scope") || "reported-message-context";

  if (!caseId || reason.length < 12) {
    throw new Error("A case and clear moderation reason are required.");
  }

  const moderationCase = await getPrisma().moderationCase.findFirst({
    select: {
      conversationId: true,
      id: true,
      messageId: true,
      status: true,
    },
    where: { id: caseId, conversationId: { not: null } },
  });
  if (!moderationCase?.conversationId) {
    throw new Error("Message content can only be revealed from a linked case.");
  }

  await getPrisma().$transaction(async (tx) => {
    await tx.moderationMessageScope.create({
      data: {
        caseId: moderationCase.id,
        conversationId: moderationCase.conversationId!,
        messageId: moderationCase.messageId,
        reason,
        revealedById: admin.id,
        scope,
      },
    });
    await tx.moderationCase.update({
      data: { status: "IN_REVIEW" },
      where: { id: moderationCase.id },
    });
    await tx.moderationCaseEvent.create({
      data: {
        actorId: admin.id,
        caseId: moderationCase.id,
        nextStatus: "IN_REVIEW",
        note: "Scoped message context revealed after reason confirmation.",
        previousStatus: moderationCase.status,
        reason,
        type: "message_scope.revealed",
      },
    });
    await tx.auditLog.create({
      data: {
        action: "admin.message_scope.revealed",
        actorId: admin.id,
        entityId: moderationCase.id,
        entityType: "moderation_case",
        metadata: {
          conversationId: moderationCase.conversationId,
          messageId: moderationCase.messageId,
          reasonProvided: true,
          scope,
        },
      },
    });
  });

  revalidatePath("/admin/messages");
  revalidatePath(`/admin/moderation/cases/${caseId}`);
}

export async function updateModerationCaseStatusAction(formData: FormData) {
  const admin = await requireCapabilityOrNotFound("admin:moderate");
  const caseId = textValue(formData, "caseId");
  const status = textValue(formData, "status");
  const reason = textValue(formData, "reason");

  const parsedStatus = z.enum(caseStatusValues).safeParse(status);
  if (!caseId || !parsedStatus.success || reason.length < 8) {
    throw new Error("A case, status, and reason are required.");
  }

  const moderationCase = await getPrisma().moderationCase.findUnique({
    select: { status: true },
    where: { id: caseId },
  });
  if (!moderationCase) throw new Error("Case not found.");

  await getPrisma().$transaction(async (tx) => {
    await tx.moderationCase.update({
      data: { status: parsedStatus.data as ModerationCaseStatus },
      where: { id: caseId },
    });
    await tx.moderationCaseEvent.create({
      data: {
        actorId: admin.id,
        caseId,
        nextStatus: parsedStatus.data,
        previousStatus: moderationCase.status,
        reason,
        type: "case.status_changed",
      },
    });
    await tx.auditLog.create({
      data: {
        action: "admin.case.status_changed",
        actorId: admin.id,
        entityId: caseId,
        entityType: "moderation_case",
        metadata: {
          fromStatus: moderationCase.status,
          reasonProvided: true,
          toStatus: parsedStatus.data,
        },
      },
    });
  });

  revalidatePath("/admin/reports");
  revalidatePath("/admin/messages");
  revalidatePath("/admin/moderation");
  revalidatePath(`/admin/moderation/cases/${caseId}`);
}

export async function applyEnforcementAction(formData: FormData) {
  const admin = await requireCapabilityOrNotFound("enforcement:manage");
  const caseId = textValue(formData, "caseId");
  const targetUserId = textValue(formData, "targetUserId");
  const type = textValue(formData, "type");
  const reason = textValue(formData, "reason");
  const userFacingExplanation = textValue(formData, "userFacingExplanation");
  const internalNote = textValue(formData, "internalNote");
  const confirmation = textValue(formData, "confirmation");
  const parsedType = z.enum(enforcementTypeValues).safeParse(type);

  if (
    !caseId ||
    !targetUserId ||
    !parsedType.success ||
    reason.length < 8 ||
    userFacingExplanation.length < 8 ||
    internalNote.length < 8
  ) {
    throw new Error("Case, target, reason, user explanation, and internal note are required.");
  }

  if (parsedType.data === "PERMANENT_BAN" && confirmation !== "PERMANENT_BAN") {
    throw new Error("Permanent ban requires confirmation.");
  }

  const moderationCase = await getPrisma().moderationCase.findUnique({
    select: { id: true, status: true },
    where: { id: caseId },
  });
  if (!moderationCase) throw new Error("Case not found.");

  const target = await getPrisma().user.findUnique({
    select: {
      bannedAt: true,
      connectionRequestsRestrictedUntil: true,
      deactivatedAt: true,
      enforcementReasonPublic: true,
      id: true,
      isActive: true,
      messagingRestrictedUntil: true,
      publishingRestrictedUntil: true,
      suspendedAt: true,
      suspendedUntil: true,
    },
    where: { id: targetUserId },
  });
  if (!target) throw new Error("Target user not found.");

  const expiresAt =
    parsedType.data === "WARNING" ||
    parsedType.data === "INDEFINITE_SUSPENSION" ||
    parsedType.data === "DEACTIVATION" ||
    parsedType.data === "PERMANENT_BAN" ||
    parsedType.data === "RESTORATION" ||
    parsedType.data === "SESSION_REVOCATION"
      ? null
      : expiryFromForm(formData);

  if (
    [
      "MESSAGING_RESTRICTION",
      "CONNECTION_REQUEST_RESTRICTION",
      "PUBLISHING_RESTRICTION",
      "TEMPORARY_SUSPENSION",
      "VERIFICATION_REQUIRED",
    ].includes(parsedType.data) &&
    !expiresAt
  ) {
    throw new Error("Timed enforcement requires a valid expiry.");
  }

  const previousState = jsonSafeState({
    bannedAt: target.bannedAt,
    connectionRequestsRestrictedUntil: target.connectionRequestsRestrictedUntil,
    deactivatedAt: target.deactivatedAt,
    isActive: target.isActive,
    messagingRestrictedUntil: target.messagingRestrictedUntil,
    publishingRestrictedUntil: target.publishingRestrictedUntil,
    suspendedAt: target.suspendedAt,
    suspendedUntil: target.suspendedUntil,
  });

  const userUpdate: Record<string, unknown> = {
    enforcementReasonPublic: userFacingExplanation,
  };
  if (parsedType.data === "MESSAGING_RESTRICTION") {
    userUpdate.messagingRestrictedUntil = expiresAt;
  }
  if (parsedType.data === "CONNECTION_REQUEST_RESTRICTION") {
    userUpdate.connectionRequestsRestrictedUntil = expiresAt;
  }
  if (parsedType.data === "PUBLISHING_RESTRICTION") {
    userUpdate.publishingRestrictedUntil = expiresAt;
  }
  if (parsedType.data === "VERIFICATION_REQUIRED") {
    userUpdate.verificationStatus = "PENDING";
  }
  if (parsedType.data === "TEMPORARY_SUSPENSION") {
    userUpdate.suspendedAt = new Date();
    userUpdate.suspendedUntil = expiresAt;
  }
  if (parsedType.data === "INDEFINITE_SUSPENSION") {
    userUpdate.suspendedAt = new Date();
    userUpdate.suspendedUntil = null;
  }
  if (parsedType.data === "DEACTIVATION") {
    userUpdate.deactivatedAt = new Date();
    userUpdate.isActive = false;
  }
  if (parsedType.data === "PERMANENT_BAN") {
    userUpdate.bannedAt = new Date();
    userUpdate.isActive = false;
  }
  if (parsedType.data === "RESTORATION") {
    Object.assign(userUpdate, {
      bannedAt: null,
      connectionRequestsRestrictedUntil: null,
      deactivatedAt: null,
      enforcementReasonPublic: null,
      isActive: true,
      messagingRestrictedUntil: null,
      publishingRestrictedUntil: null,
      suspendedAt: null,
      suspendedUntil: null,
    });
  }

  await getPrisma().$transaction(async (tx) => {
    if (parsedType.data !== "WARNING" && parsedType.data !== "SESSION_REVOCATION") {
      await tx.user.update({
        data: userUpdate,
        where: { id: targetUserId },
      });
    }
    if (
      parsedType.data === "SESSION_REVOCATION" ||
      parsedType.data === "TEMPORARY_SUSPENSION" ||
      parsedType.data === "INDEFINITE_SUSPENSION" ||
      parsedType.data === "DEACTIVATION" ||
      parsedType.data === "PERMANENT_BAN"
    ) {
      await tx.session.deleteMany({ where: { userId: targetUserId } });
    }

    const enforcement = await tx.enforcementAction.create({
      data: {
        actorId: admin.id,
        appealAllowed: formData.get("appealAllowed") !== "off",
        caseId,
        expiresAt,
        internalNote,
        newState: jsonSafeState(userUpdate),
        previousState,
        reason,
        targetUserId,
        type: parsedType.data as EnforcementActionType,
        userFacingExplanation,
      },
      select: { id: true },
    });

    await tx.moderationCase.update({
      data: { status: "ACTION_REQUIRED" },
      where: { id: caseId },
    });
    await tx.moderationCaseEvent.create({
      data: {
        actorId: admin.id,
        caseId,
        nextStatus: "ACTION_REQUIRED",
        previousStatus: moderationCase.status,
        reason,
        type: "enforcement.applied",
      },
    });
    await tx.auditLog.create({
      data: {
        action: "admin.enforcement.applied",
        actorId: admin.id,
        entityId: enforcement.id,
        entityType: "enforcement_action",
        metadata: {
          caseId,
          expiresAt,
          reasonProvided: true,
          targetUserId,
          type: parsedType.data,
        },
      },
    });
    await tx.notification.create({
      data: {
        actionUrl: "/app/notifications",
        body: userFacingExplanation,
        metadata: { caseId, enforcementActionId: enforcement.id },
        title: "Account enforcement update",
        type: "MODERATION_UPDATE",
        userId: targetUserId,
      },
    });
  });

  revalidatePath("/admin/reports");
  revalidatePath("/admin/messages");
  revalidatePath("/admin/moderation");
  revalidatePath("/admin/users");
  revalidatePath("/app/notifications");
  revalidatePath(`/admin/moderation/cases/${caseId}`);
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
