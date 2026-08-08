import { getPrisma } from "@/lib/db/prisma";
import {
  findOwnedConversationEventTarget,
  findOwnedMessageTarget,
  parseExactConversationEventTarget,
  parseExactMessageTarget,
  type ExactConversationEventTarget,
  type ExactMessageTarget,
} from "@/lib/messages/entry";

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
  metadata?: unknown;
  type: string;
};

const messageNotificationTypes = new Set([
  "MESSAGE",
  "MESSAGE_REQUEST_RECEIVED",
  "NEW_MESSAGE",
]);

const approvedExactPaths = new Set([
  "/app",
  "/app/connections",
  "/app/connections/requests",
  "/app/deals",
  "/app/manage",
  "/app/messages",
  "/app/news",
  "/app/notifications",
  "/app/opportunities",
  "/app/people",
  "/app/proposals",
  "/app/reports",
  "/app/search",
  "/app/service-center",
  "/app/trust",
]);

function actionLabel(type: string) {
  if (messageNotificationTypes.has(type)) {
    return "Message";
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
  if (["PROPOSAL", "PROPOSAL_UPDATE"].includes(type)) return "Review proposal";
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
  const url = new URL(path, "https://perx.local");

  if (approvedExactPaths.has(path.split("?")[0] ?? path)) return true;

  if (segments[0] === "app" && segments[1] === "messages" && segments[2]) {
    const participant = await prisma.conversationParticipant.findUnique({
      select: { id: true, removedAt: true },
      where: {
        conversationId_userId: {
          conversationId: segments[2],
          userId,
        },
      },
    });
    if (!participant || participant.removedAt) return false;

    const messageId = url.searchParams.get("message");
    const eventId = url.searchParams.get("event");
    if (messageId && eventId) return false;
    if (messageId) {
      const target = parseExactMessageTarget(path);
      if (!target) return false;
      return Boolean(await findOwnedMessageTarget(userId, target));
    }
    if (eventId) {
      const target = parseExactConversationEventTarget(path);
      if (!target) return false;
      return Boolean(await findOwnedConversationEventTarget(userId, target));
    }
    return url.searchParams.size === 0;
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

function actionUrlFromMetadata(notification: NotificationForAction) {
  if (!messageNotificationTypes.has(notification.type)) return null;
  if (!notification.metadata || typeof notification.metadata !== "object") return null;
  const metadata = notification.metadata as {
    conversationId?: unknown;
    messageId?: unknown;
  };
  if (
    typeof metadata.conversationId !== "string" ||
    typeof metadata.messageId !== "string"
  ) {
    return null;
  }
  return `/app/messages/${metadata.conversationId}?message=${metadata.messageId}`;
}

function metadataMatchesMessageTarget(
  userId: string,
  notification: NotificationForAction,
  target: ExactMessageTarget,
  message: { senderId: string },
) {
  if (!notification.metadata || typeof notification.metadata !== "object") {
    return true;
  }

  const metadata = notification.metadata as Record<string, unknown>;
  const expectedValues: [unknown, string][] = [
    [metadata.conversationId, target.conversationId],
    [metadata.messageId, target.messageId],
    [metadata.recipientId, userId],
    [metadata.senderId, message.senderId],
  ];

  return expectedValues.every(
    ([value, expected]) => value === undefined || value === expected,
  );
}

function metadataMatchesConversationEvent(
  userId: string,
  notification: NotificationForAction,
  target: ExactConversationEventTarget,
  event: {
    dealId: string | null;
    proposalVersionId: string | null;
  },
) {
  if (!notification.metadata || typeof notification.metadata !== "object") {
    return true;
  }
  const metadata = notification.metadata as Record<string, unknown>;
  const expectedValues: [unknown, string | null][] = [
    [metadata.conversationId, target.conversationId],
    [metadata.conversationEventId, target.eventId],
    [metadata.recipientId, userId],
    [metadata.dealId, event.dealId],
    [metadata.proposalVersionId, event.proposalVersionId],
  ];
  return expectedValues.every(
    ([value, expected]) => value === undefined || value === expected,
  );
}

export async function resolveNotificationAction(
  userId: string,
  notification: NotificationForAction,
): Promise<NotificationActionResolution> {
  const rawActionUrl =
    notification.actionUrl ?? actionUrlFromMetadata(notification);
  const normalized = normalizeNotificationActionUrl(rawActionUrl);
  if (!rawActionUrl) {
    return {
      available: false,
      href: null,
      label: messageNotificationTypes.has(notification.type)
        ? "This message is no longer available."
        : "No action available",
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

  if (messageNotificationTypes.has(notification.type)) {
    const target = parseExactMessageTarget(normalized);
    if (!target) {
      return {
        available: false,
        href: null,
        label: "This message is no longer available.",
        reason: "unavailable",
      };
    }

    const message = await findOwnedMessageTarget(userId, target);
    if (
      !message ||
      !metadataMatchesMessageTarget(userId, notification, target, message)
    ) {
      return {
        available: false,
        href: null,
        label: "This message is no longer available.",
        reason: "unavailable",
      };
    }

    return {
      available: true,
      href: target.href,
      label: actionLabel(notification.type),
    };
  }


  const conversationEventTarget = parseExactConversationEventTarget(normalized);
  if (conversationEventTarget) {
    const event = await findOwnedConversationEventTarget(
      userId,
      conversationEventTarget,
    );
    if (
      !event ||
      !metadataMatchesConversationEvent(
        userId,
        notification,
        conversationEventTarget,
        event,
      )
    ) {
      return {
        available: false,
        href: null,
        label: "This item is no longer available.",
        reason: "unavailable",
      };
    }
    return {
      available: true,
      href: conversationEventTarget.href,
      label: actionLabel(notification.type),
    };
  }

  const available = await isDestinationAvailable(userId, normalized);
  if (!available) {
    return {
      available: false,
      href: null,
      label: messageNotificationTypes.has(notification.type)
        ? "This message is no longer available."
        : "This item is no longer available.",
      reason: "unavailable",
    };
  }

  return {
    available: true,
    href: normalized,
    label: actionLabel(notification.type),
  };
}
