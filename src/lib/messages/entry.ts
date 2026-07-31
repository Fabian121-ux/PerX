import { getPrisma } from "@/lib/db/prisma";

export type ExactMessageTarget = {
  conversationId: string;
  href: string;
  messageId: string;
};

const routeIdPattern = /^[A-Za-z0-9_-]+$/;

export function parseExactMessageTarget(value: string): ExactMessageTarget | null {
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

export async function findOwnedMessageTarget(
  userId: string,
  target: Pick<ExactMessageTarget, "conversationId" | "messageId">,
) {
  return getPrisma().message.findFirst({
    select: { conversationId: true, id: true, senderId: true },
    where: {
      conversation: {
        participants: { some: { userId } },
        status: "ACTIVE",
      },
      conversationId: target.conversationId,
      deletedAt: null,
      id: target.messageId,
      sender: {
        conversations: { some: { conversationId: target.conversationId } },
      },
    },
  });
}
