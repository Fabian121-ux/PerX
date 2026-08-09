import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { parseMessageRouteId } from "@/lib/messages/entry";
import {
  createMessageMutationBaseline,
  getMessageMutationsAfter,
  validateMessageMutationCursor,
} from "@/lib/messages/mutations";
import { getMessageSnapshot } from "@/lib/messages/snapshot";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 },
    );
  }

  const url = new URL(request.url);
  const rawConversationId = url.searchParams.get("conversationId");
  const conversationId = rawConversationId
    ? parseMessageRouteId(rawConversationId)
    : null;
  if (rawConversationId && !conversationId) {
    return NextResponse.json(
      { error: "Invalid conversation." },
      { status: 400 },
    );
  }
  const requestedMutationCursor = conversationId
    ? url.searchParams.get("mutationCursor")
    : null;
  let mutationCursor = conversationId
    ? createMessageMutationBaseline(user.id, conversationId)
    : null;
  if (requestedMutationCursor && conversationId) {
    try {
      validateMessageMutationCursor(
        requestedMutationCursor,
        user.id,
        conversationId,
      );
      mutationCursor = requestedMutationCursor;
    } catch {
      return NextResponse.json({ error: "Invalid cursor." }, { status: 400 });
    }
  }
  const snapshot = await getMessageSnapshot({
    conversationId,
    userId: user.id,
  });

  if (snapshot.notFound) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const mutationPage =
    conversationId && mutationCursor
      ? await getMessageMutationsAfter({
          conversationId,
          cursor: mutationCursor,
          userId: user.id,
        })
      : null;

  return NextResponse.json({
    conversationList: snapshot.conversationList,
    conversations: snapshot.conversations ?? [],
    messageMutations: mutationPage?.items ?? [],
    mutationCursor: mutationPage?.checkpoint ?? mutationCursor,
  });
}
