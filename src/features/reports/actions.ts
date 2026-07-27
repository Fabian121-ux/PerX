"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import type {
  UserReportStatus,
  UserReportTargetType,
} from "@/generated/prisma/enums";
import { requireUser } from "@/lib/auth/session";
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
};

export async function submitUserReportAction(formData: FormData) {
  const user = await requireUser();
  const parsed = reportSchema.safeParse({
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

  const report = await getPrisma().userReport.create({
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
  redirect("/app/reports?submitted=1");
}

async function getReportAccessContext(
  reporterId: string,
  report: z.infer<typeof reportSchema>,
): Promise<ReportContext | null> {
  const prisma = getPrisma();

  if (report.targetType === "MESSAGE") {
    const message = await prisma.message.findFirst({
      select: { conversationId: true, id: true },
      where: {
        id: report.targetId,
        conversation: { participants: { some: { userId: reporterId } } },
      },
    });
    if (!message) return null;
    return {
      contextConversationId: message.conversationId,
      contextMessageId: message.id,
    };
  }

  if (report.targetType === "CONVERSATION") {
    const participant = await prisma.conversationParticipant.findUnique({
      select: { conversationId: true },
      where: {
        conversationId_userId: {
          conversationId: report.targetId,
          userId: reporterId,
        },
      },
    });
    return participant
      ? { contextConversationId: participant.conversationId }
      : null;
  }

  if (report.targetType === "USER") {
    if (report.targetId === reporterId) return null;
    const user = await prisma.user.findFirst({
      select: { id: true },
      where: { id: report.targetId, isActive: true },
    });
    return user ? {} : null;
  }

  if (
    report.targetType === "OPPORTUNITY" ||
    report.targetType === "REAL_ESTATE_LISTING"
  ) {
    const opportunity = await prisma.opportunity.findFirst({
      select: { id: true },
      where: {
        id: report.targetId,
        moderationStatus: { in: ["APPROVED", "FLAGGED"] },
        status: { in: ["PUBLISHED", "PAUSED"] },
      },
    });
    return opportunity ? {} : null;
  }

  if (report.targetType === "DEAL") {
    const deal = await prisma.deal.findFirst({
      select: { id: true },
      where: {
        id: report.targetId,
        participants: { some: { userId: reporterId } },
      },
    });
    return deal ? {} : null;
  }

  if (report.targetType === "REVIEW") {
    const review = await prisma.review.findFirst({
      select: { id: true },
      where: {
        id: report.targetId,
        OR: [
          { authorId: reporterId },
          { subjectId: reporterId },
          { visibility: "PUBLIC" },
        ],
      },
    });
    return review ? {} : null;
  }

  return null;
}
