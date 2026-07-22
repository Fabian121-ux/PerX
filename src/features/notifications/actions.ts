"use server";

import { revalidatePath } from "next/cache";
import { getPrisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/session";

export async function markNotificationAsReadAction(id: string) {
  const user = await requireUser();

  await getPrisma().notification.updateMany({
    where: { id, userId: user.id },
    data: { readAt: new Date() },
  });

  revalidatePath("/app/notifications");
}

export async function markAllNotificationsAsReadAction() {
  const user = await requireUser();

  await getPrisma().notification.updateMany({
    where: { userId: user.id, readAt: null },
    data: { readAt: new Date() },
  });

  revalidatePath("/app/notifications");
}
