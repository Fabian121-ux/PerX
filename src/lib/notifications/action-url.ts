import { getPrisma } from "@/lib/db/prisma";

export type NotificationActionResolution =
  | {
      available: true;
      href: string;
      label: string;
    }
  | {
      available: false;
      href: null;
      label: string;
      reason: "missing" | "unavailable" | "unsafe";
    };

type NotificationForAction = {
  actionUrl: string | null;
  type: string;
};

const approvedExactPaths = new Set([
  "/app",
  "/app/connections",
  "/app/connections/requests",
  "/app/deals",
  "/app/manage",
  "/app/messages",
  "/app/notifications",
  "/app/opportunities",
  "/app/people",
  "/app/proposals",
  "/app/reports",
  "/app/service-center",
  "/app/trust",
]);

function actionLabel(type: string) {
  if (["MESSAGE", "MESSAGE_REQUEST_RECEIVED", "NEW_MESSAGE"].includes(type)) {
    return "View message";
  }
  if (
    [
      "CONNECTION",
      "CONNECTION_REQUEST_ACCEPTED",
      "CONNECTION_REQUEST_DECLINED",
      "CONNECTION_REQUEST_RECEIVED",
    ].includes(type)
  ) {
    return "View";
  }
  if (["SUPPORT", "SUPPORT_REPLY"].includes(type)) return "View ticket";
  if (["DEAL", "DEAL_UPDATE"].includes(type)) return "View deal";
  if (type === "BROADCAST") return "View details";
  return "Open";
}

export function normalizeNotificationActionUrl(value: string | null | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null;
  if (value.includes("\\") || value.includes("\n") || value.includes("\r")) return null;

  try {
    const url = new URL(value, "https://perx.local");
    if (url.origin !== "https://perx.local") return null;
    if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/admin/")) {
      return null;
    }
    if (url.pathname === "/admin") return null;
    return `${url.pathname}${url.search}`;
  } catch {
    return null;
  }
}

function pathSegments(path: string) {
  return path.split("?")[0]?.split("/").filter(Boolean) ?? [];
}

async function isDestinationAvailable(userId: string, path: string) {
  const prisma = getPrisma();
  const segments = pathSegments(path);

  if (approvedExactPaths.has(path.split("?")[0] ?? path)) return true;

  if (segments[0] === "app" && segments[1] === "messages" && segments[2]) {
    const participant = await prisma.conversationParticipant.findUnique({
      select: { id: true },
      where: {
        conversationId_userId: {
          conversationId: segments[2],
          userId,
        },
      },
    });
    return Boolean(participant);
  }

  if (segments[0] === "u" && segments[1]) {
    const profile = await prisma.user.findFirst({
      select: { id: true },
      where: {
        isActive: true,
        profile: { is: { isDiscoverable: true } },
        username: segments[1],
      },
    });
    return Boolean(profile);
  }

  if (segments[0] === "app" && segments[1] === "opportunities" && segments[2]) {
    const opportunity = await prisma.opportunity.findFirst({
      select: { id: true },
      where: {
        id: segments[2],
        OR: [
          { ownerId: userId },
          { moderationStatus: "APPROVED", status: "PUBLISHED" },
        ],
      },
    });
    return Boolean(opportunity);
  }

  if (segments[0] === "opportunities" && segments[1]) {
    const opportunity = await prisma.opportunity.findFirst({
      select: { id: true },
      where: {
        moderationStatus: "APPROVED",
        slug: segments[1],
        status: "PUBLISHED",
      },
    });
    return Boolean(opportunity);
  }

  if (segments[0] === "app" && segments[1] === "deals" && segments[2]) {
    const deal = await prisma.deal.findFirst({
      select: { id: true },
      where: {
        id: segments[2],
        participants: { some: { userId } },
      },
    });
    return Boolean(deal);
  }

  return false;
}

export async function resolveNotificationAction(
  userId: string,
  notification: NotificationForAction,
): Promise<NotificationActionResolution> {
  const normalized = normalizeNotificationActionUrl(notification.actionUrl);
  if (!notification.actionUrl) {
    return {
      available: false,
      href: null,
      label: "No action available",
      reason: "missing",
    };
  }
  if (!normalized) {
    return {
      available: false,
      href: null,
      label: "This notification has an unsafe action.",
      reason: "unsafe",
    };
  }

  const available = await isDestinationAvailable(userId, normalized);
  if (!available) {
    return {
      available: false,
      href: null,
      label: "This item is no longer available.",
      reason: "unavailable",
    };
  }

  return {
    available: true,
    href: normalized,
    label: actionLabel(notification.type),
  };
}
