"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { Prisma } from "@/generated/prisma/client";
import type {
  EnforcementActionType,
  ModerationCaseStatus,
} from "@/generated/prisma/enums";
import {
  activeMessageModerationCaseStatuses,
  caseTitleForReport,
  messageModerationCaseSources,
  messageReviewScopeOptions,
  sourceForReportTarget,
} from "@/lib/admin/moderation-records";
import { requireCapabilityOrNotFound } from "@/lib/auth/session";
import { getPrisma } from "@/lib/db/prisma";
import { writeAuditLog } from "@/lib/logging/audit";
import { normalizeNotificationActionUrl } from "@/lib/notifications/action-url";
import { lockUserAccount } from "@/lib/network/pair-lock";
import { issuePasswordResetToken } from "@/lib/auth/password-reset";
import {
  buildPasswordResetUrl,
  passwordResetDelivery,
} from "@/lib/auth/password-reset-delivery";
import { isUnavailableInvestmentPublication } from "@/lib/opportunities/publication";

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
  if (duration === "14d")
    return new Date(now.getTime() + 14 * 24 * 60 * 60_000);
  if (duration === "30d")
    return new Date(now.getTime() + 30 * 24 * 60 * 60_000);
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

type LegacyReportForCase = {
  reporterId: string;
  targetId: string;
  targetType: string;
};

async function resolveReportedUserIdForLegacyReport(
  report: LegacyReportForCase,
) {
  if (report.targetType === "USER") {
    return report.targetId === report.reporterId ? null : report.targetId;
  }

  if (report.targetType === "MESSAGE") {
    const message = await getPrisma().message.findFirst({
      select: {
        senderId: true,
        conversation: {
          select: {
            participants: {
              select: { userId: true },
              take: 3,
            },
          },
        },
      },
      where: { id: report.targetId },
    });
    if (!message || message.senderId === report.reporterId) return null;
    return message.senderId;
  }

  if (report.targetType === "CONVERSATION") {
    const conversation = await getPrisma().conversation.findFirst({
      select: {
        participants: {
          select: { userId: true },
          take: 3,
        },
      },
      where: { id: report.targetId },
    });
    return (
      conversation?.participants.find(
        (participant) => participant.userId !== report.reporterId,
      )?.userId ?? null
    );
  }

  if (
    report.targetType === "OPPORTUNITY" ||
    report.targetType === "REAL_ESTATE_LISTING"
  ) {
    const opportunity = await getPrisma().opportunity.findUnique({
      select: { ownerId: true },
      where: { id: report.targetId },
    });
    return opportunity?.ownerId === report.reporterId
      ? null
      : (opportunity?.ownerId ?? null);
  }

  if (report.targetType === "DEAL") {
    const deal = await getPrisma().deal.findFirst({
      select: {
        participants: {
          select: { userId: true },
          take: 3,
        },
      },
      where: { id: report.targetId },
    });
    return (
      deal?.participants.find(
        (participant) => participant.userId !== report.reporterId,
      )?.userId ?? null
    );
  }

  if (report.targetType === "REVIEW") {
    const review = await getPrisma().review.findUnique({
      select: { authorId: true, subjectId: true },
      where: { id: report.targetId },
    });
    if (!review) return null;
    return review.authorId === report.reporterId
      ? review.subjectId
      : review.authorId;
  }

  return null;
}

export async function recordConversationReviewAction(formData: FormData) {
  const admin = await requireCapabilityOrNotFound("messages:moderate");
  const conversationId = textValue(formData, "conversationId");
  const reason = textValue(formData, "reason");
  const outcome = textValue(formData, "outcome") || "metadata-reviewed";

  if (!conversationId || reason.length < 12) {
    throw new Error(
      "A conversation and a clear moderation reason are required.",
    );
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
  const requestedScope = textValue(formData, "scope");
  const scope = messageReviewScopeOptions.find(
    (option) => option.value === requestedScope,
  )?.value;
  const confirmed = formData.get("confirmScope") === "on";

  if (
    !caseId ||
    !scope ||
    reason.length < 12 ||
    reason.length > 500 ||
    !confirmed
  ) {
    throw new Error(
      "A case, clear reason, selected scope, and confirmation are required.",
    );
  }

  await getPrisma().$transaction(async (tx) => {
    const moderationCase = await tx.moderationCase.findFirst({
      select: {
        conversationId: true,
        id: true,
        messageId: true,
        reporterId: true,
        source: true,
        status: true,
        targetId: true,
        targetType: true,
      },
      where: {
        conversationId: { not: null },
        id: caseId,
        messageId: { not: null },
        source: { in: [...messageModerationCaseSources] },
        status: { in: [...activeMessageModerationCaseStatuses] },
      },
    });
    if (!moderationCase?.conversationId || !moderationCase.messageId) {
      throw new Error(
        "Message content can only be revealed from an active linked case.",
      );
    }
    const claimedCase = await tx.moderationCase.updateMany({
      data: { status: "IN_REVIEW" },
      where: {
        conversationId: moderationCase.conversationId,
        id: moderationCase.id,
        messageId: moderationCase.messageId,
        source: { in: [...messageModerationCaseSources] },
        status: { in: [...activeMessageModerationCaseStatuses] },
      },
    });
    if (claimedCase.count !== 1) {
      throw new Error(
        "Message content can only be revealed from an active linked case.",
      );
    }
    const message = await tx.message.findFirst({
      select: { id: true, senderId: true },
      where: {
        conversationId: moderationCase.conversationId,
        id: moderationCase.messageId,
      },
    });
    if (!message) throw new Error("Reported message unavailable.");
    if (
      moderationCase.source === "MESSAGE_REPORT" &&
      (!moderationCase.reporterId ||
        moderationCase.targetType !== "MESSAGE" ||
        moderationCase.targetId !== message.id ||
        moderationCase.reporterId === message.senderId)
    ) {
      throw new Error("Reported message unavailable.");
    }

    await tx.moderationMessageScope.create({
      data: {
        caseId: moderationCase.id,
        conversationId: moderationCase.conversationId,
        messageId: message.id,
        reason,
        revealedById: admin.id,
        scope,
      },
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
          messageAvailable: true,
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

export async function createModerationCaseForReportAction(formData: FormData) {
  const admin = await requireCapabilityOrNotFound("admin:moderate");
  const reportId = textValue(formData, "reportId");
  if (!reportId) throw new Error("Report is required.");

  const report = await getPrisma().userReport.findUnique({
    select: {
      category: true,
      contextConversationId: true,
      contextMessageId: true,
      createdAt: true,
      id: true,
      reporterId: true,
      status: true,
      targetId: true,
      targetType: true,
    },
    where: { id: reportId },
  });
  if (!report) throw new Error("Report not found.");
  if (report.status !== "SUBMITTED" && report.status !== "IN_REVIEW") {
    throw new Error(
      "Only active reports can be converted into moderation cases.",
    );
  }

  const existing = await getPrisma().moderationCase.findFirst({
    select: { id: true },
    where: { linkedReportId: report.id },
  });
  if (existing) {
    revalidatePath("/admin/reports");
    revalidatePath(`/admin/moderation/cases/${existing.id}`);
    return;
  }

  let canonicalConversationId = report.contextConversationId;
  let canonicalMessageId = report.contextMessageId;
  let reportedUserId: string | null;
  if (report.targetType === "MESSAGE") {
    const message = await getPrisma().message.findFirst({
      select: { conversationId: true, id: true, senderId: true },
      where: {
        id: report.targetId,
        conversation: {
          participants: { some: { userId: report.reporterId } },
        },
      },
    });
    if (!message || message.senderId === report.reporterId) {
      throw new Error("Reported message target unavailable.");
    }
    canonicalConversationId = message.conversationId;
    canonicalMessageId = message.id;
    reportedUserId = message.senderId;
  } else {
    reportedUserId = await resolveReportedUserIdForLegacyReport(report);
  }
  const moderationCase = await getPrisma().$transaction(async (tx) => {
    const created = await tx.moderationCase.create({
      data: {
        category: report.category,
        conversationId: canonicalConversationId,
        linkedReportId: report.id,
        messageId: canonicalMessageId,
        priority: "NORMAL",
        reportedUserId,
        reporterId: report.reporterId,
        source: sourceForReportTarget(report.targetType),
        status: "NEW",
        summary:
          "Legacy report converted into a moderation case with metadata only.",
        targetId: report.targetId,
        targetType: report.targetType,
        title: caseTitleForReport(report.targetType, report.category),
      },
      select: { id: true },
    });
    await tx.moderationCaseEvent.create({
      data: {
        actorId: admin.id,
        caseId: created.id,
        nextStatus: "NEW",
        note: "Case created for legacy report without revealing private evidence.",
        reason: "Legacy report case creation",
        type: "case.created_from_legacy_report",
      },
    });
    await tx.auditLog.create({
      data: {
        action: "admin.case.created_from_legacy_report",
        actorId: admin.id,
        entityId: created.id,
        entityType: "moderation_case",
        metadata: {
          reasonProvided: true,
          reportId: report.id,
          targetType: report.targetType,
        },
      },
    });
    return created;
  });

  revalidatePath("/admin/reports");
  revalidatePath("/admin/messages");
  revalidatePath("/admin/moderation");
  revalidatePath(`/admin/moderation/cases/${moderationCase.id}`);
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
    throw new Error(
      "Case, target, reason, user explanation, and internal note are required.",
    );
  }

  if (parsedType.data === "PERMANENT_BAN" && confirmation !== "PERMANENT_BAN") {
    throw new Error("Permanent ban requires confirmation.");
  }

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
    await lockUserAccount(tx, targetUserId);
    const moderationCase = await tx.moderationCase.findFirst({
      select: {
        conversationId: true,
        messageId: true,
        reportedUserId: true,
        reporterId: true,
        source: true,
        status: true,
        targetId: true,
        targetType: true,
      },
      where: {
        id: caseId,
        status: { in: [...activeMessageModerationCaseStatuses] },
      },
    });
    if (!moderationCase) throw new Error("Case is not eligible for enforcement.");
    if (
      !moderationCase.reportedUserId ||
      moderationCase.reportedUserId !== targetUserId
    ) {
      throw new Error(
        "The enforcement target does not match this moderation case.",
      );
    }
    const claimedCase = await tx.moderationCase.updateMany({
      data: { status: "ACTION_REQUIRED" },
      where: {
        id: caseId,
        reportedUserId: targetUserId,
        status: { in: [...activeMessageModerationCaseStatuses] },
      },
    });
    if (claimedCase.count !== 1) {
      throw new Error("Case is not eligible for enforcement.");
    }
    if (moderationCase.source === "MESSAGE_REPORT") {
      if (
        !moderationCase.conversationId ||
        !moderationCase.messageId ||
        moderationCase.targetType !== "MESSAGE" ||
        moderationCase.targetId !== moderationCase.messageId
      ) {
        throw new Error("Reported message target unavailable.");
      }
      const reportedMessage = await tx.message.findFirst({
        select: { id: true, senderId: true },
        where: {
          conversationId: moderationCase.conversationId,
          id: moderationCase.messageId,
        },
      });
      if (
        !reportedMessage ||
        !moderationCase.reporterId ||
        moderationCase.targetId !== reportedMessage.id ||
        moderationCase.reportedUserId !== reportedMessage.senderId ||
        moderationCase.reporterId === reportedMessage.senderId
      ) {
        throw new Error("Reported message target unavailable.");
      }
    }
    const target = await tx.user.findUnique({
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
    const previousState = jsonSafeState({
      bannedAt: target.bannedAt,
      connectionRequestsRestrictedUntil:
        target.connectionRequestsRestrictedUntil,
      deactivatedAt: target.deactivatedAt,
      isActive: target.isActive,
      messagingRestrictedUntil: target.messagingRestrictedUntil,
      publishingRestrictedUntil: target.publishingRestrictedUntil,
      suspendedAt: target.suspendedAt,
      suspendedUntil: target.suspendedUntil,
    });
    if (
      parsedType.data !== "WARNING" &&
      parsedType.data !== "SESSION_REVOCATION"
    ) {
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

  const expiresAt = parsed.data.expiresAt
    ? new Date(parsed.data.expiresAt)
    : null;
  if (expiresAt && Number.isNaN(expiresAt.getTime())) {
    throw new Error("Broadcast expiry is invalid.");
  }

  const audienceWhere =
    parsed.data.audience === "PUBLIC_BETA_USERS"
      ? { accountClassification: "PUBLIC_BETA_USER" as const, isActive: true }
      : parsed.data.audience === "INTERNAL_TEST_USERS"
        ? {
            accountClassification: "INTERNAL_TEST_USER" as const,
            isActive: true,
          }
        : parsed.data.audience === "ADMINISTRATORS"
          ? {
              isActive: true,
              roles: { some: { role: { name: "ADMIN" as const } } },
            }
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
            actionUrl: actionUrl ?? "/app/news",
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
          failedCount: Math.max(
            0,
            recipients.length - notificationResult.count,
          ),
          hasActionUrl: Boolean(actionUrl),
        },
      },
    });

    return {
      broadcastId: broadcast.id,
      deliveryCount: notificationResult.count,
    };
  });

  await writeAuditLog({
    actorId: admin.id,
    action: "admin.broadcast.completed",
    entityId: result.broadcastId,
    entityType: "adminBroadcast",
    metadata: { deliveryCount: result.deliveryCount },
  });

  revalidatePath("/admin/broadcasts");
  revalidatePath("/app/news");
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

  const hasPublishingRequirements =
    listing.images.some((image) => image.isCover) &&
    Boolean(
      listing.authorityDeclaration &&
      listing.contactPreference &&
      listing.listingRulesAccepted &&
      listing.propertyListingType &&
      listing.propertyType,
    );
  if (decision === "approve" && !hasPublishingRequirements) {
    throw new Error("Property listing requirements are incomplete.");
  }
  if (
    decision === "approve" &&
    isUnavailableInvestmentPublication(listing)
  ) {
    throw new Error("Co-investment listings are not available for publication.");
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

  const reviewed = await getPrisma().$transaction(async (tx) => {
    const result = await tx.opportunity.updateMany({
      data: {
        ...next,
        verificationNotes: reason,
      },
      where: {
        id: listing.id,
        type: "PROPERTY",
        ...(decision === "approve"
          ? {
              authorityDeclaration: { not: null },
              contactPreference: { not: null },
              images: { some: { isCover: true } },
              listingRulesAccepted: true,
              propertyListingType: { in: ["SALE", "RENT", "LEASE"] as const },
              propertyType: { not: null },
            }
          : {}),
      },
    });
    if (result.count !== 1) return false;
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
    return true;
  });
  if (!reviewed) {
    throw new Error("Listing changed during review. Review it again.");
  }

  revalidatePath("/admin/real-estate");
  revalidatePath("/admin/opportunities");
  revalidatePath("/app/manage");
  revalidatePath("/discover");
}

/**
 * Initiate a password reset for a user, as an authorized admin.
 *
 * Deliberately a *link initiation*, not a password replacement: the admin
 * never chooses, sees, or transports the user's password, and never sees the
 * existing bcrypt hash. The user completes the reset themselves through the
 * ordinary single-use flow, so control of the account stays with the account
 * holder.
 *
 * Gated on `users:manage` server-side. UI visibility is never the protection:
 * this action re-checks the capability on every invocation.
 */
export async function initiateUserPasswordResetAction(formData: FormData) {
  const admin = await requireCapabilityOrNotFound("users:manage");
  const userId = textValue(formData, "userId");
  if (!userId) throw new Error("Select a user to reset.");

  const user = await getPrisma().user.findUnique({
    select: { email: true, id: true, isActive: true },
    where: { id: userId },
  });
  // Same neutral failure for "missing" and "inactive": an admin tool should
  // still not become a probe for which accounts exist.
  if (!user?.isActive) {
    throw new Error("That account cannot be reset.");
  }

  const grant = await issuePasswordResetToken({
    requestedByAdminId: admin.id,
    userId: user.id,
  });
  await passwordResetDelivery.deliverPasswordResetLink({
    email: user.email,
    expiresAt: grant.expiresAt,
    resetUrl: buildPasswordResetUrl(grant.token),
  });

  // Records who did it and to whom. Never the token, password, or hash.
  await writeAuditLog({
    action: "admin.user_password_reset_initiated",
    actorId: admin.id,
    entityId: user.id,
    entityType: "user",
    metadata: { expiresAt: grant.expiresAt.toISOString() },
  });

  revalidatePath("/admin/users");
}
