import type { Prisma } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/db/prisma";

export function getVisibleNewsWhere(
  userId: string,
  now: Date = new Date(),
): Prisma.NotificationWhereInput {
  return {
    broadcast: {
      is: {
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        sentAt: { not: null },
      },
    },
    broadcastId: { not: null },
    type: "BROADCAST",
    userId,
  };
}

export async function getNewsForUser(userId: string, now: Date = new Date()) {
  const notifications = await getPrisma().notification.findMany({
    orderBy: [
      { broadcast: { sentAt: "desc" } },
      { createdAt: "desc" },
    ],
    select: {
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
      id: true,
      readAt: true,
    },
    where: getVisibleNewsWhere(userId, now),
  });

  return notifications.flatMap((notification) => {
    if (
      !notification.broadcast?.sentAt ||
      (notification.broadcast.expiresAt &&
        notification.broadcast.expiresAt <= now)
    ) {
      return [];
    }

    return [
      {
        ...notification.broadcast,
        notificationId: notification.id,
        readAt: notification.readAt,
        sentAt: notification.broadcast.sentAt,
      },
    ];
  });
}
