import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
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
  const conversationId = url.searchParams.get("conversationId");
  const snapshot = await getMessageSnapshot({
    conversationId,
    userId: user.id,
  });

  if (snapshot.notFound) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  return NextResponse.json({ conversations: snapshot.conversations ?? [] });
}
