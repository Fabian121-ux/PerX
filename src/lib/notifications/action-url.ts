import { getPrisma } from "@/lib/db/prisma";
import {
  findOwnedConversationEventTarget,
  findOwnedMessageTarget,
  parseExactConversationEventTarget,
  parseExactMessageTarget,
  type ExactConversationEventTarget,
  type ExactMessageTarget,
} from "@/lib/messages/entry";
import { buildConversationAccessWhere } from "@/lib/messages/access";

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

type NotificationForBatchAction = NotificationForAction & { id: string };

type DynamicDestination =
  | { id: string; kind: "conversation" }
  | { id: string; kind: "deal" }
  | { id: string; kind: "opportunity" }
  | { kind: "profile"; username: string }
  | { kind: "public-opportunity"; slug: string }
  | { kind: "static" };

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

export function normalizeNotificationActionUrl(
  value: string | null | undefined,
) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null;
  if (value.includes("\\") || value.includes("\n") || value.includes("\r"))
    return null;

  try {
    const url = new URL(value, "https://perx.local");
    if (url.origin !== "https://perx.local") return null;
    if (
      url.pathname.startsWith("/api/") ||
      url.pathname.startsWith("/admin/")
    ) {
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

function parseDynamicDestination(path: string): DynamicDestination | null {
  const segments = pathSegments(path);
  const url = new URL(path, "https://perx.local");
  const pathname = url.pathname;

  if (approvedExactPaths.has(pathname)) return { kind: "static" };
  if (url.searchParams.size > 0) return null;

  if (
    segments.length === 3 &&
    segments[0] === "app" &&
    segments[1] === "messages" &&
    segments[2]
  ) {
    return { id: segments[2], kind: "conversation" };
  }
  if (segments.length === 2 && segments[0] === "u" && segments[1]) {
    return { kind: "profile", username: segments[1] };
  }
  if (
    (segments.length === 3 ||
      (segments.length === 4 && segments[3] === "edit")) &&
    segments[0] === "app" &&
    segments[1] === "opportunities" &&
    segments[2]
  ) {
    return { id: segments[2], kind: "opportunity" };
  }
  if (segments.length === 2 && segments[0] === "opportunities" && segments[1]) {
    return { kind: "public-opportunity", slug: segments[1] };
  }
  if (
    (segments.length === 3 ||
      (segments.length === 4 &&
        ["deliveries", "escrow", "milestones"].includes(segments[3]!))) &&
    segments[0] === "app" &&
    segments[1] === "deals" &&
    segments[2]
  ) {
    return { id: segments[2], kind: "deal" };
  }

  return null;
}

async function isDestinationAvailable(userId: string, path: string) {
  const prisma = getPrisma();
  const destination = parseDynamicDestination(path);
  if (!destination) return false;
  if (destination.kind === "static") return true;

  if (destination.kind === "conversation") {
    const conversation = await prisma.conversation.findFirst({
      select: { id: true },
      where: { ...buildConversationAccessWhere(userId), id: destination.id },
    });
    return Boolean(conversation);
  }

  if (destination.kind === "profile") {
    const profile = await prisma.user.findFirst({
      select: { id: true },
      where: {
        isActive: true,
        profile: { is: { isDiscoverable: true } },
        username: destination.username,
      },
    });
    return Boolean(profile);
  }

  if (destination.kind === "opportunity") {
    const opportunity = await prisma.opportunity.findFirst({
      select: { id: true },
      where: {
        id: destination.id,
        OR: [
          { ownerId: userId },
          { moderationStatus: "APPROVED", status: "PUBLISHED" },
        ],
      },
    });
    return Boolean(opportunity);
  }

  if (destination.kind === "public-opportunity") {
    const opportunity = await prisma.opportunity.findFirst({
      select: { id: true },
      where: {
        moderationStatus: "APPROVED",
        slug: destination.slug,
        status: "PUBLISHED",
      },
    });
    return Boolean(opportunity);
  }

  if (destination.kind === "deal") {
    const deal = await prisma.deal.findFirst({
      select: { id: true },
      where: {
        id: destination.id,
        participants: { some: { userId } },
      },
    });
    return Boolean(deal);
  }

  return false;
}

function unavailableAction(type: string): NotificationActionResolution {
  return {
    available: false,
    href: null,
    label: messageNotificationTypes.has(type)
      ? "This message is no longer available."
      : "This item is no longer available.",
    reason: "unavailable",
  };
}

export async function resolveNotificationActions(
  userId: string,
  notifications: readonly NotificationForBatchAction[],
) {
  const resolutions = new Map<string, NotificationActionResolution>();
  const messageTargets: Array<{
    notification: NotificationForBatchAction;
    target: ExactMessageTarget;
  }> = [];
  const eventTargets: Array<{
    notification: NotificationForBatchAction;
    target: ExactConversationEventTarget;
  }> = [];
  const dynamicTargets: Array<{
    destination: DynamicDestination;
    href: string;
    notification: NotificationForBatchAction;
  }> = [];

  for (const notification of notifications) {
    const rawActionUrl =
      notification.actionUrl ?? actionUrlFromMetadata(notification);
    const normalized = normalizeNotificationActionUrl(rawActionUrl);
    if (!rawActionUrl) {
      resolutions.set(notification.id, {
        available: false,
        href: null,
        label: messageNotificationTypes.has(notification.type)
          ? "This message is no longer available."
          : "No action available",
        reason: "missing",
      });
      continue;
    }
    if (!normalized) {
      resolutions.set(notification.id, {
        available: false,
        href: null,
        label: "This notification has an unsafe action.",
        reason: "unsafe",
      });
      continue;
    }

    if (messageNotificationTypes.has(notification.type)) {
      const target = parseExactMessageTarget(normalized);
      if (target) messageTargets.push({ notification, target });
      else
        resolutions.set(notification.id, unavailableAction(notification.type));
      continue;
    }

    const eventTarget = parseExactConversationEventTarget(normalized);
    if (eventTarget) {
      eventTargets.push({ notification, target: eventTarget });
      continue;
    }

    const destination = parseDynamicDestination(normalized);
    if (destination) {
      dynamicTargets.push({ destination, href: normalized, notification });
    } else {
      resolutions.set(notification.id, unavailableAction(notification.type));
    }
  }

  const prisma = getPrisma();
  const conversationIds = dynamicTargets
    .filter((target) => target.destination.kind === "conversation")
    .map((target) => (target.destination as { id: string }).id);
  const dealIds = dynamicTargets
    .filter((target) => target.destination.kind === "deal")
    .map((target) => (target.destination as { id: string }).id);
  const opportunityIds = dynamicTargets
    .filter((target) => target.destination.kind === "opportunity")
    .map((target) => (target.destination as { id: string }).id);
  const publicOpportunitySlugs = dynamicTargets
    .filter((target) => target.destination.kind === "public-opportunity")
    .map((target) => (target.destination as { slug: string }).slug);
  const profileUsernames = dynamicTargets
    .filter((target) => target.destination.kind === "profile")
    .map((target) => (target.destination as { username: string }).username);

  const [messages, events, conversations, deals, opportunities, profiles] =
    await Promise.all([
      messageTargets.length
        ? prisma.message.findMany({
            select: { conversationId: true, id: true, senderId: true },
            where: {
              conversation: buildConversationAccessWhere(userId),
              deletedAt: null,
              OR: messageTargets.map(({ target }) => ({
                conversationId: target.conversationId,
                id: target.messageId,
                sender: {
                  conversations: {
                    some: { conversationId: target.conversationId },
                  },
                },
              })),
            },
          })
        : Promise.resolve([]),
      eventTargets.length
        ? prisma.conversationEvent.findMany({
            select: {
              conversationId: true,
              dealId: true,
              id: true,
              proposalVersionId: true,
            },
            where: {
              conversation: buildConversationAccessWhere(userId),
              OR: eventTargets.map(({ target }) => ({
                conversationId: target.conversationId,
                id: target.eventId,
              })),
            },
          })
        : Promise.resolve([]),
      conversationIds.length
        ? prisma.conversation.findMany({
            select: { id: true },
            where: {
              ...buildConversationAccessWhere(userId),
              id: { in: conversationIds },
            },
          })
        : Promise.resolve([]),
      dealIds.length
        ? prisma.deal.findMany({
            select: { id: true },
            where: {
              id: { in: dealIds },
              participants: { some: { userId } },
            },
          })
        : Promise.resolve([]),
      opportunityIds.length || publicOpportunitySlugs.length
        ? prisma.opportunity.findMany({
            select: { id: true, slug: true },
            where: {
              OR: [
                ...(opportunityIds.length
                  ? [
                      {
                        id: { in: opportunityIds },
                        OR: [
                          { ownerId: userId },
                          {
                            moderationStatus: "APPROVED" as const,
                            status: "PUBLISHED" as const,
                          },
                        ],
                      },
                    ]
                  : []),
                ...(publicOpportunitySlugs.length
                  ? [
                      {
                        moderationStatus: "APPROVED" as const,
                        slug: { in: publicOpportunitySlugs },
                        status: "PUBLISHED" as const,
                      },
                    ]
                  : []),
              ],
            },
          })
        : Promise.resolve([]),
      profileUsernames.length
        ? prisma.user.findMany({
            select: { username: true },
            where: {
              isActive: true,
              profile: { is: { isDiscoverable: true } },
              username: { in: profileUsernames },
            },
          })
        : Promise.resolve([]),
    ]);

  const messagesByKey = new Map(
    messages.map((message) => [
      `${message.conversationId}:${message.id}`,
      message,
    ]),
  );
  const eventsByKey = new Map(
    events.map((event) => [`${event.conversationId}:${event.id}`, event]),
  );
  const availableConversationIds = new Set(
    conversations.map((conversation) => conversation.id),
  );
  const availableDealIds = new Set(deals.map((deal) => deal.id));
  const availableOpportunityIds = new Set(
    opportunities.map((opportunity) => opportunity.id),
  );
  const availableOpportunitySlugs = new Set(
    opportunities.map((opportunity) => opportunity.slug),
  );
  const availableProfileUsernames = new Set(
    profiles.map((profile) => profile.username),
  );

  for (const { notification, target } of messageTargets) {
    const message = messagesByKey.get(
      `${target.conversationId}:${target.messageId}`,
    );
    resolutions.set(
      notification.id,
      message &&
        metadataMatchesMessageTarget(userId, notification, target, message)
        ? {
            available: true,
            href: target.href,
            label: actionLabel(notification.type),
          }
        : unavailableAction(notification.type),
    );
  }
  for (const { notification, target } of eventTargets) {
    const event = eventsByKey.get(`${target.conversationId}:${target.eventId}`);
    resolutions.set(
      notification.id,
      event &&
        metadataMatchesConversationEvent(userId, notification, target, event)
        ? {
            available: true,
            href: target.href,
            label: actionLabel(notification.type),
          }
        : unavailableAction(notification.type),
    );
  }
  for (const { destination, href, notification } of dynamicTargets) {
    const available =
      destination.kind === "static" ||
      (destination.kind === "conversation" &&
        availableConversationIds.has(destination.id)) ||
      (destination.kind === "deal" && availableDealIds.has(destination.id)) ||
      (destination.kind === "opportunity" &&
        availableOpportunityIds.has(destination.id)) ||
      (destination.kind === "public-opportunity" &&
        availableOpportunitySlugs.has(destination.slug)) ||
      (destination.kind === "profile" &&
        availableProfileUsernames.has(destination.username));
    resolutions.set(
      notification.id,
      available
        ? { available: true, href, label: actionLabel(notification.type) }
        : unavailableAction(notification.type),
    );
  }

  return resolutions;
}

function actionUrlFromMetadata(notification: NotificationForAction) {
  if (!messageNotificationTypes.has(notification.type)) return null;
  if (!notification.metadata || typeof notification.metadata !== "object")
    return null;
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
