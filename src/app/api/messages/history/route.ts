import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { getConversationMessagesPage } from "@/lib/data/app";
import {
  decodeCursor,
  MAX_CURSOR_PAGE_SIZE,
} from "@/lib/data/cursor";
import { parseMessageRouteId } from "@/lib/messages/entry";
import { getServerEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

type ProviderMessage = {
  body: string;
  createdAt: Date | string;
  deletedAt?: Date | string | null;
  editedAt?: Date | string | null;
  id: string;
  replyTo?: {
    body: string;
    deletedAt?: Date | null;
    id: string;
    sender?: { name: string | null; username: string | null } | null;
    senderId: string;
  } | null;
  sender?: {
    imageUrl?: string | null;
    name: string | null;
    username: string | null;
  } | null;
  senderName?: string;
  senderId: string;
};

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 },
    );
  }

  const url = new URL(request.url);
  const conversationId = parseMessageRouteId(
    url.searchParams.get("conversationId"),
  );
  if (!conversationId) {
    return NextResponse.json(
      { error: "Conversation is required." },
      { status: 400 },
    );
  }

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

  let page;
  try {
    page = await getConversationMessagesPage(conversationId, user.id, {
      cursor: rawCursor ?? undefined,
      pageSize,
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

  return NextResponse.json({
    cursor: page.cursor,
    items: page.items.map((message) =>
      toWorkspaceMessage(message as ProviderMessage),
    ),
    nextCursor: page.nextCursor,
    pageSize: page.pageSize,
  });
}

function toWorkspaceMessage(message: ProviderMessage) {
  const createdAt = new Date(message.createdAt);
  return {
    body: message.deletedAt ? "" : message.body,
    canMutate:
      !message.deletedAt &&
      Date.now() - createdAt.getTime() <=
        getServerEnv().MESSAGE_EDIT_WINDOW_MINUTES * 60_000,
    createdAt: createdAt.toISOString(),
    deletedAt: message.deletedAt ? toIsoString(message.deletedAt) : null,
    editedAt: message.editedAt ? toIsoString(message.editedAt) : null,
    id: message.id,
    replyTo: message.replyTo
      ? {
          body: message.replyTo.deletedAt ? "" : message.replyTo.body,
          deletedAt: message.replyTo.deletedAt
            ? toIsoString(message.replyTo.deletedAt)
            : null,
          id: message.replyTo.id,
          senderId: message.replyTo.senderId,
          senderName:
            message.replyTo.sender?.name ??
            message.replyTo.sender?.username ??
            "Participant",
        }
      : null,
    senderId: message.senderId,
    senderImageUrl: message.sender?.imageUrl ?? null,
    senderName:
      message.sender?.name ??
      message.sender?.username ??
      message.senderName ??
      "Participant",
  };
}

function toIsoString(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
