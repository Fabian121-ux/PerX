import { NextResponse } from "next/server";

import { getPrisma } from "@/lib/db/prisma";
import { sendPushToSubscription } from "@/lib/push/web-push";
import { normalizeNotificationActionUrl } from "@/lib/notifications/action-url";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function categoryFor(type: string) {
  if (["MESSAGE", "NEW_MESSAGE", "MESSAGE_REQUEST_RECEIVED"].includes(type)) return "messages";
  if (type.startsWith("CONNECTION")) return "connections";
  if (["DEAL", "DEAL_UPDATE", "PROPOSAL", "PROPOSAL_UPDATE"].includes(type)) return "deals";
  if (type === "OPPORTUNITY_RESPONSE") return "opportunities";
  return "system";
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const prisma = getPrisma();
  const since = new Date(Date.now() - 5 * 60_000);
  const notifications = await prisma.notification.findMany({
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: {
      actionUrl: true,
      body: true,
      id: true,
      title: true,
      type: true,
      userId: true,
    },
    take: 500,
    where: { createdAt: { gte: since } },
  });

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const notification of notifications) {
    const category = categoryFor(notification.type);
    const subscriptions = await prisma.pushSubscription.findMany({
      select: { auth: true, endpoint: true, id: true, p256dh: true },
      where: { categories: { has: category }, userId: notification.userId },
    });

    for (const subscription of subscriptions) {
      const compoundKey = {
        notificationId_subscriptionId: {
          notificationId: notification.id,
          subscriptionId: subscription.id,
        },
      };
      const existing = await prisma.pushDelivery.findUnique({
        select: { attempts: true, id: true, processingAt: true, status: true },
        where: compoundKey,
      });
      if (existing?.status === "SENT" || (existing && existing.attempts >= 3)) {
        skipped += 1;
        continue;
      }
      if (existing?.status === "PROCESSING" && existing.processingAt &&
          Date.now() - existing.processingAt.getTime() < 5 * 60_000) {
        skipped += 1;
        continue;
      }

      let deliveryId = existing?.id;
      try {
        if (existing) {
          const claimed = await prisma.pushDelivery.updateMany({
            data: {
              attempts: { increment: 1 },
              lastError: null,
              processingAt: new Date(),
              status: "PROCESSING",
            },
            where: {
              attempts: { lt: 3 },
              id: existing.id,
              OR: [
                { status: { in: ["PENDING", "FAILED"] } },
                { processingAt: { lt: new Date(Date.now() - 5 * 60_000) } },
              ],
            },
          });
          if (!claimed.count) {
            skipped += 1;
            continue;
          }
        } else {
          const created = await prisma.pushDelivery.create({
            data: {
              attempts: 1,
              notificationId: notification.id,
              processingAt: new Date(),
              status: "PROCESSING",
              subscriptionId: subscription.id,
            },
            select: { id: true },
          });
          deliveryId = created.id;
        }

        await sendPushToSubscription(subscription, {
          body: notification.body.slice(0, 180),
          tag: `notification-${notification.id}`,
          title: notification.title.slice(0, 80),
          url: normalizeNotificationActionUrl(notification.actionUrl) ?? "/app/notifications",
        });
        await prisma.pushDelivery.update({
          data: { lastError: null, processingAt: null, sentAt: new Date(), status: "SENT" },
          where: { id: deliveryId! },
        });
        sent += 1;
      } catch (error) {
        if (deliveryId) {
          await prisma.pushDelivery.update({
            data: {
              lastError: error instanceof Error ? error.message.slice(0, 500) : "Push delivery failed.",
              processingAt: null,
              status: "FAILED",
            },
            where: { id: deliveryId },
          }).catch(() => undefined);
        }
        failed += 1;
      }
    }
  }

  return NextResponse.json({ failed, notifications: notifications.length, sent, skipped });
}
