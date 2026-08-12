import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { getPrisma } from "@/lib/db/prisma";
import { buildConversationAccessWhere } from "@/lib/messages/access";
import { parseMessageRouteId } from "@/lib/messages/entry";
import { MAX_LOADED_CONVERSATIONS } from "@/lib/messages/limits";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 },
    );
  }

  const body = (await request.json().catch(() => null)) as {
    conversationIds?: unknown;
  } | null;
  if (
    !Array.isArray(body?.conversationIds) ||
    body.conversationIds.length > MAX_LOADED_CONVERSATIONS
  ) {
    return NextResponse.json(
      { error: "Invalid conversation list." },
      { status: 400 },
    );
  }
  const conversationIds = [
    ...new Set(
      body.conversationIds.map((id) =>
        typeof id === "string" ? parseMessageRouteId(id) : null,
      ),
    ),
  ];
  if (conversationIds.some((id) => !id)) {
    return NextResponse.json(
      { error: "Invalid conversation list." },
      { status: 400 },
    );
  }

  const authorized = await getPrisma().conversation.findMany({
    select: { id: true },
    take: MAX_LOADED_CONVERSATIONS,
    where: {
      ...buildConversationAccessWhere(user.id),
      id: { in: conversationIds as string[] },
    },
  });

  return NextResponse.json({ ids: authorized.map((conversation) => conversation.id) });
}
