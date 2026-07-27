"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getPrisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/session";
import { resolveNotificationAction } from "@/lib/notifications/action-url";

export async function markNotificationAsReadAction(id: string) {
  const user = await requireUser();

  await getPrisma().notification.updateMany({
    where: { id, userId: user.id },
    data: { readAt: new Date() },
  });

  revalidatePath("/app/notifications");
}

export async function markNotificationAsUnreadAction(id: string) {
  const user = await requireUser();

  await getPrisma().notification.updateMany({
    where: { id, userId: user.id },
    data: { readAt: null },
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

export async function openNotificationAction(id: string) {
  const user = await requireUser();
  const notification = await getPrisma().notification.findFirst({
    select: { actionUrl: true, id: true, metadata: true, type: true },
    where: { id, userId: user.id },
  });

  if (!notification) redirect("/app/notifications");

  const action = await resolveNotificationAction(user.id, notification);
  if (!action.available) {
    redirect("/app/notifications?unavailable=1");
  }

  await getPrisma().notification.updateMany({
    data: { readAt: new Date() },
    where: { id: notification.id, userId: user.id },
  });

  revalidatePath("/app/notifications");
  redirect(action.href);
}
