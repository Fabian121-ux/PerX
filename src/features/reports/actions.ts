"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import type {
  ModerationCaseSource,
  UserReportStatus,
  UserReportTargetType,
} from "@/generated/prisma/enums";
import { requireUser } from "@/lib/auth/session";
import { assertAccountAccess } from "@/lib/account/enforcement";
import { getPrisma } from "@/lib/db/prisma";
import { reportReasonValues } from "@/lib/options";
import { writeAuditLog } from "@/lib/logging/audit";

const reportTargetValues = [
  "MESSAGE",
  "CONVERSATION",
  "USER",
  "OPPORTUNITY",
  "DEAL",
  "REVIEW",
  "REAL_ESTATE_LISTING",
  "OTHER_CONTENT",
] as const;

const reportSchema = z.object({
  blockAfterReport: z.boolean().default(false),
  category: z.enum(reportReasonValues),
  contextConversationId: z.string().cuid().optional().nullable(),
  contextMessageId: z.string().cuid().optional().nullable(),
  details: z.string().trim().max(1200).optional(),
  targetId: z.string().trim().min(1).max(120),
  targetType: z.enum(reportTargetValues),
});

type ReportContext = {
  contextConversationId?: string | null;
  contextMessageId?: string | null;
  reportedUserId?: string | null;
};

export async function submitUserReportAction(formData: FormData) {
  const user = await requireUser();
  const accountRestriction = await assertAccountAccess(user.id, "report");
  if (accountRestriction) redirect(`/app/reports/new?error=${encodeURIComponent(accountRestriction)}`);
  const parsed = reportSchema.safeParse({
    blockAfterReport: formData.get("blockAfterReport") === "on",
    category: formData.get("category"),
    contextConversationId: formData.get("contextConversationId") || null,
    contextMessageId: formData.get("contextMessageId") || null,
    details: formData.get("details") ?? "",
    targetId: formData.get("targetId"),
    targetType: formData.get("targetType"),
  });

  if (!parsed.success) {
    redirect("/app/reports/new?error=invalid");
  }

  const access = await getReportAccessContext(user.id, parsed.data);
  if (!access) {
    redirect("/app/reports/new?error=unavailable");
  }

  const openStatuses: UserReportStatus[] = ["SUBMITTED", "IN_REVIEW"];
  const existing = await getPrisma().userReport.findFirst({
    select: { id: true },
    where: {
      reporterId: user.id,
      status: { in: openStatuses },
      targetId: parsed.data.targetId,
      targetType: parsed.data.targetType as UserReportTargetType,
    },
  });

  if (existing) {
    redirect("/app/reports?alreadySubmitted=1");
  }

  const report = await getPrisma().$transaction(async (tx) => {
    const createdReport = await tx.userReport.create({
      data: {
        category: parsed.data.category,
        contextConversationId:
          access.contextConversationId ?? parsed.data.contextConversationId,
        contextMessageId: access.contextMessageId ?? parsed.data.contextMessageId,
        details: parsed.data.details || null,
        reporterId: user.id,
        targetId: parsed.data.targetId,
        targetType: parsed.data.targetType as UserReportTargetType,
      },
      select: { id: true },
    });

    const moderationCase = await tx.moderationCase.create({
      data: {
        category: parsed.data.category,
        conversationId:
          access.contextConversationId ?? parsed.data.contextConversationId,
        linkedReportId: createdReport.id,
        messageId: access.contextMessageId ?? parsed.data.contextMessageId,
        reporterId: user.id,
        reportedUserId: access.reportedUserId ?? null,
        source: sourceForTarget(parsed.data.targetType),
        summary:
          parsed.data.details ||
          `User submitted a ${parsed.data.category.replaceAll("_", " ")} report.`,
        targetId: parsed.data.targetId,
        targetType: parsed.data.targetType,
        title: `${parsed.data.targetType.replaceAll("_", " ")} report`,
        events: {
          create: {
            actorId: user.id,
            nextStatus: "NEW",
            note: "Case opened from user report.",
            type: "case.opened",
          },
        },
      },
      select: { id: true },
    });

    if (parsed.data.blockAfterReport && access.reportedUserId) {
      await tx.blockedUser.upsert({
        create: {
          blockedUserId: access.reportedUserId,
          blockerUserId: user.id,
          reason: `Report ${createdReport.id}`,
        },
        update: { reason: `Report ${createdReport.id}` },
        where: {
          blockerUserId_blockedUserId: {
            blockedUserId: access.reportedUserId,
            blockerUserId: user.id,
          },
        },
      });
      await tx.connection.updateMany({
        data: { status: "BLOCKED" },
        where: {
          OR: [
            { requesterId: user.id, receiverId: access.reportedUserId },
            { requesterId: access.reportedUserId, receiverId: user.id },
          ],
        },
      });
    }

    await tx.auditLog.create({
      data: {
        action: "moderation.case.created",
        actorId: user.id,
        entityId: moderationCase.id,
        entityType: "moderation_case",
        metadata: {
          linkedReportId: createdReport.id,
          targetType: parsed.data.targetType,
        },
      },
    });

    return createdReport;
  });

  await writeAuditLog({
    actorId: user.id,
    action: "report.submitted",
    entityId: report.id,
    entityType: "user_report",
    metadata: {
      category: parsed.data.category,
      targetType: parsed.data.targetType,
    },
  });

  revalidatePath("/app/reports");
  revalidatePath("/admin/reports");
  revalidatePath("/admin/messages");
  revalidatePath("/admin/moderation");
  revalidatePath("/app/people");
  revalidatePath("/app/settings/blocked");
  redirect("/app/reports?submitted=1");
}

function sourceForTarget(targetType: string): ModerationCaseSource {
  if (targetType === "MESSAGE") return "MESSAGE_REPORT";
  if (targetType === "CONVERSATION") return "CONVERSATION_REPORT";
  if (targetType === "DEAL") return "DEAL_DISPUTE";
  if (targetType === "OPPORTUNITY" || targetType === "REAL_ESTATE_LISTING") {
    return "LISTING_REPORT";
  }
  return "USER_REPORT";
}

async function getReportAccessContext(
  reporterId: string,
  report: z.infer<typeof reportSchema>,
): Promise<ReportContext | null> {
  const prisma = getPrisma();

  if (report.targetType === "MESSAGE") {
    const message = await prisma.message.findFirst({
      select: {
        conversationId: true,
        id: true,
        senderId: true,
        conversation: {
          select: {
            participants: { select: { userId: true } },
          },
        },
      },
      where: {
        id: report.targetId,
        conversation: { participants: { some: { userId: reporterId } } },
      },
    });
    if (!message) return null;
    return {
      contextConversationId: message.conversationId,
      contextMessageId: message.id,
      reportedUserId:
        message.senderId !== reporterId
          ? message.senderId
          : message.conversation.participants.find(
              (participant) => participant.userId !== reporterId,
            )?.userId ?? null,
    };
  }

  if (report.targetType === "CONVERSATION") {
    const participant = await prisma.conversationParticipant.findUnique({
      select: {
        conversation: {
          select: { participants: { select: { userId: true } } },
        },
        conversationId: true,
      },
      where: {
        conversationId_userId: {
          conversationId: report.targetId,
          userId: reporterId,
        },
      },
    });
    return participant
      ? {
          contextConversationId: participant.conversationId,
          reportedUserId:
            participant.conversation.participants.find(
              (entry) => entry.userId !== reporterId,
            )?.userId ?? null,
        }
      : null;
  }

  if (report.targetType === "USER") {
    if (report.targetId === reporterId) return null;
    const user = await prisma.user.findFirst({
      select: { id: true },
      where: { id: report.targetId, isActive: true },
    });
    return user ? { reportedUserId: user.id } : null;
  }

  if (
    report.targetType === "OPPORTUNITY" ||
    report.targetType === "REAL_ESTATE_LISTING"
  ) {
    const opportunity = await prisma.opportunity.findFirst({
      select: { id: true, ownerId: true },
      where: {
        id: report.targetId,
        moderationStatus: { in: ["APPROVED", "FLAGGED"] },
        status: { in: ["PUBLISHED", "PAUSED"] },
      },
    });
    return opportunity ? { reportedUserId: opportunity.ownerId } : null;
  }

  if (report.targetType === "DEAL") {
    const deal = await prisma.deal.findFirst({
      select: { id: true, participants: { select: { userId: true } } },
      where: {
        id: report.targetId,
        participants: { some: { userId: reporterId } },
      },
    });
    return deal
      ? {
          reportedUserId:
            deal.participants.find((participant) => participant.userId !== reporterId)
              ?.userId ?? null,
        }
      : null;
  }

  if (report.targetType === "REVIEW") {
    const review = await prisma.review.findFirst({
      select: { authorId: true, id: true, subjectId: true },
      where: {
        id: report.targetId,
        OR: [
          { authorId: reporterId },
          { subjectId: reporterId },
          { visibility: "PUBLIC" },
        ],
      },
    });
    return review
      ? {
          reportedUserId:
            review.authorId === reporterId ? review.subjectId : review.authorId,
        }
      : null;
  }

  return null;
}
