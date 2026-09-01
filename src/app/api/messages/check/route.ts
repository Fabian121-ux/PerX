import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { probeMessageChanges } from "@/lib/messages/change-probe";
import { parseMessageRouteId } from "@/lib/messages/entry";

export const dynamic = "force-dynamic";

/**
 * Lightweight degraded-mode change probe.
 *
 * Answers only "has anything relevant changed since `since`?" so the fallback
 * loop no longer has to rebuild the full snapshot (~44 queries, ~78 KB) just to
 * discover that nothing happened.
 *
 * The viewer is always derived from the server session; the request cannot
 * supply an identity. Authorization uses the same predicate as the snapshot, so
 * an inaccessible conversation returns 404 without disclosing whether it
 * exists.
 */
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

  const result = await probeMessageChanges({
    conversationId,
    since: url.searchParams.get("since"),
    userId: user.id,
  });

  if (!result.authorized) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  return NextResponse.json(
    { changed: result.changed, version: result.version },
    { headers: { "Cache-Control": "no-store" } },
  );
}
