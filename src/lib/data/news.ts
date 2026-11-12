import type { Prisma } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/db/prisma";

export function getVisibleNewsWhere(
  userId: string,
  now: Date = new Date(),
): Prisma.NotificationWhereInput {
  return {
    userId,
    OR: [
      {
        broadcast: {
          is: {
            OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
            sentAt: { not: null },
          },
        },
        broadcastId: { not: null },
        type: "BROADCAST",
      },
      // Personal system announcements (including signup welcome) remain in News.
      { broadcastId: null, type: "SYSTEM" },
    ],
  };
}

export async function getNewsForUser(userId: string, now: Date = new Date()) {
  const notifications = await getPrisma().notification.findMany({
    orderBy: [{ createdAt: "desc" }],
    select: {
      actionUrl: true,
      body: true,
      broadcast: {
        select: {
          actionUrl: true,
          body: true,
          expiresAt: true,
          id: true,
          priority: true,
          sentAt: true,
          title: true,
        },
      },
      broadcastId: true,
      createdAt: true,
      id: true,
      readAt: true,
      title: true,
      type: true,
    },
    where: getVisibleNewsWhere(userId, now),
  });

  return notifications.flatMap((notification) => {
    if (notification.type === "SYSTEM" && !notification.broadcastId) {
      return [{
        actionUrl: notification.actionUrl,
        body: notification.body,
        expiresAt: null,
        id: notification.id,
        notificationId: notification.id,
        priority: "NORMAL",
        readAt: notification.readAt,
        sentAt: notification.createdAt,
        title: notification.title,
      }];
    }

    if (
      !notification.broadcast?.sentAt ||
      (notification.broadcast.expiresAt &&
        notification.broadcast.expiresAt <= now)
    ) return [];

    return [{
      ...notification.broadcast,
      notificationId: notification.id,
      readAt: notification.readAt,
      sentAt: notification.broadcast.sentAt,
    }];
  });
}
