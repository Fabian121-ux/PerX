import { getPrisma } from "@/lib/db/prisma";
import { buildConversationAccessWhere } from "@/lib/messages/access";

export type ExactMessageTarget = {
  conversationId: string;
  href: string;
  messageId: string;
};

export type ExactConversationEventTarget = {
  conversationId: string;
  eventId: string;
  href: string;
};

const routeIdPattern = /^[A-Za-z0-9_-]+$/;

export function parseMessageRouteId(value: unknown): string | null {
  return typeof value === "string" && routeIdPattern.test(value) ? value : null;
}

export function parseExactMessageTarget(
  value: string,
): ExactMessageTarget | null {
  try {
    const url = new URL(value, "https://perx.local");
    const segments = url.pathname.split("/").filter(Boolean);
    const messageValues = url.searchParams.getAll("message");
    const queryEntries = [...url.searchParams.entries()];

    if (
      url.origin !== "https://perx.local" ||
      segments.length !== 3 ||
      segments[0] !== "app" ||
      segments[1] !== "messages" ||
      !routeIdPattern.test(segments[2] ?? "") ||
      messageValues.length !== 1 ||
      queryEntries.length !== 1 ||
      queryEntries[0]?.[0] !== "message" ||
      !routeIdPattern.test(messageValues[0] ?? "")
    ) {
      return null;
    }

    const conversationId = segments[2]!;
    const messageId = messageValues[0]!;
    return {
      conversationId,
      href: `/app/messages/${conversationId}?message=${messageId}`,
      messageId,
    };
  } catch {
    return null;
  }
}

export function parseExactConversationEventTarget(
  value: string,
): ExactConversationEventTarget | null {
  try {
    const url = new URL(value, "https://perx.local");
    const segments = url.pathname.split("/").filter(Boolean);
    const eventValues = url.searchParams.getAll("event");
    const queryEntries = [...url.searchParams.entries()];

    if (
      url.origin !== "https://perx.local" ||
      segments.length !== 3 ||
      segments[0] !== "app" ||
      segments[1] !== "messages" ||
      !routeIdPattern.test(segments[2] ?? "") ||
      eventValues.length !== 1 ||
      queryEntries.length !== 1 ||
      queryEntries[0]?.[0] !== "event" ||
      !routeIdPattern.test(eventValues[0] ?? "")
    ) {
      return null;
    }

    const conversationId = segments[2]!;
    const eventId = eventValues[0]!;
    return {
      conversationId,
      eventId,
      href: `/app/messages/${conversationId}?event=${eventId}`,
    };
  } catch {
    return null;
  }
}

export async function findOwnedMessageTarget(
  userId: string,
  target: Pick<ExactMessageTarget, "conversationId" | "messageId">,
) {
  return getPrisma().message.findFirst({
    select: { conversationId: true, id: true, senderId: true },
    where: {
      conversation: buildConversationAccessWhere(userId),
      conversationId: target.conversationId,
      deletedAt: null,
      id: target.messageId,
      sender: {
        conversations: { some: { conversationId: target.conversationId } },
      },
    },
  });
}

export async function findOwnedConversationEventTarget(
  userId: string,
  target: Pick<ExactConversationEventTarget, "conversationId" | "eventId">,
) {
  return getPrisma().conversationEvent.findFirst({
    where: {
      conversation: buildConversationAccessWhere(userId),
      conversationId: target.conversationId,
      id: target.eventId,
    },
  });
}
