"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/session";
import { getPrisma } from "@/lib/db/prisma";
import { writeAuditLog } from "@/lib/logging/audit";

export async function dismissOnboardingChecklistAction() {
  const user = await requireUser();

  await getPrisma().user.update({
    data: { onboardingDismissedAt: new Date() },
    where: { id: user.id },
  });

  await writeAuditLog({
    actorId: user.id,
    action: "onboarding.dismissed",
    entityId: user.id,
    entityType: "user",
  });

  revalidatePath("/app");
}
