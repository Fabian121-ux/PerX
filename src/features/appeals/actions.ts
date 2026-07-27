"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireUser } from "@/lib/auth/session";
import { getPrisma } from "@/lib/db/prisma";
import { writeAuditLog } from "@/lib/logging/audit";

const appealSchema = z.object({
  body: z.string().trim().min(20).max(1500),
  enforcementActionId: z.string().cuid(),
});

export async function submitAppealAction(formData: FormData) {
  const user = await requireUser();
  const parsed = appealSchema.safeParse({
    body: formData.get("body"),
    enforcementActionId: formData.get("enforcementActionId"),
  });

  if (!parsed.success) {
    redirect("/app/appeals?error=invalid");
  }

  const enforcement = await getPrisma().enforcementAction.findFirst({
    select: { appealAllowed: true, caseId: true, id: true },
    where: {
      appealAllowed: true,
      id: parsed.data.enforcementActionId,
      targetUserId: user.id,
    },
  });
  if (!enforcement) redirect("/app/appeals?error=unavailable");

  const existing = await getPrisma().enforcementAppeal.findFirst({
    select: { id: true },
    where: {
      appellantId: user.id,
      enforcementActionId: enforcement.id,
      status: { in: ["SUBMITTED", "IN_REVIEW"] },
    },
  });
  if (existing) redirect("/app/appeals?alreadySubmitted=1");

  const appeal = await getPrisma().$transaction(async (tx) => {
    const created = await tx.enforcementAppeal.create({
      data: {
        appellantId: user.id,
        body: parsed.data.body,
        caseId: enforcement.caseId,
        enforcementActionId: enforcement.id,
      },
      select: { id: true },
    });
    await tx.moderationCase.update({
      data: { status: "APPEALED" },
      where: { id: enforcement.caseId },
    });
    await tx.moderationCaseEvent.create({
      data: {
        actorId: user.id,
        caseId: enforcement.caseId,
        nextStatus: "APPEALED",
        note: "User submitted an appeal.",
        type: "appeal.submitted",
      },
    });
    return created;
  });

  await writeAuditLog({
    actorId: user.id,
    action: "enforcement.appeal_submitted",
    entityId: appeal.id,
    entityType: "enforcement_appeal",
    metadata: { enforcementActionId: enforcement.id },
  });

  revalidatePath("/app/appeals");
  revalidatePath("/admin/moderation");
  redirect("/app/appeals?submitted=1");
}
