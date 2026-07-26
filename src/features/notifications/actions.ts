"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
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

function safeInternalPath(value: string | null | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/app/notifications";
  }
  if (value.includes("\\") || value.includes("\n") || value.includes("\r")) {
    return "/app/notifications";
  }
  return value;
}

export async function openNotificationAction(id: string) {
  const user = await requireUser();
  const notification = await getPrisma().notification.findFirst({
    select: { actionUrl: true, id: true },
    where: { id, userId: user.id },
  });

  if (!notification) redirect("/app/notifications");

  await getPrisma().notification.update({
    data: { readAt: new Date() },
    where: { id: notification.id },
  });

  revalidatePath("/app/notifications");
  redirect(safeInternalPath(notification.actionUrl));
}
