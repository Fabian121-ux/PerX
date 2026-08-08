import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { getConversationsPage } from "@/lib/data/app";
import { decodeCursor, MAX_CURSOR_PAGE_SIZE } from "@/lib/data/cursor";
import { toWorkspaceConversation } from "@/lib/messages/workspace-conversation";

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
  const rawCursor = url.searchParams.get("cursor");
  if (rawCursor && !decodeCursor(rawCursor)) {
    return NextResponse.json({ error: "Invalid cursor." }, { status: 400 });
  }

  const rawPageSize = url.searchParams.get("pageSize");
  let pageSize = MAX_CURSOR_PAGE_SIZE;
  if (rawPageSize !== null) {
    const requestedPageSize = Number(rawPageSize);
    if (
      !Number.isInteger(requestedPageSize) ||
      requestedPageSize < 1 ||
      requestedPageSize > MAX_CURSOR_PAGE_SIZE
    ) {
      return NextResponse.json(
        { error: `Page size must be between 1 and ${MAX_CURSOR_PAGE_SIZE}.` },
        { status: 400 },
      );
    }
    pageSize = requestedPageSize;
  }

  try {
    const page = await getConversationsPage(user.id, {
      cursor: rawCursor ?? undefined,
      pageSize,
    });

    return NextResponse.json({
      cursor: page.cursor,
      conversations: page.items.map((conversation) =>
        toWorkspaceConversation(conversation, user),
      ),
      nextCursor: page.nextCursor,
      pageSize: page.pageSize,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === "Invalid cursor." ||
        error.message === "Invalid cursor scope.")
    ) {
      return NextResponse.json({ error: "Invalid cursor." }, { status: 400 });
    }
    throw error;
  }
}
