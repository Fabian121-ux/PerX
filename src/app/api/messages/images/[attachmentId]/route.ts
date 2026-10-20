import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth/session";
import { getPrisma } from "@/lib/db/prisma";
import { buildConversationAccessWhere } from "@/lib/messages/access";
import {
  downloadMessageImage,
  isMessageImageStorageConfigured,
  isValidStoredMessageImageKey,
} from "@/lib/uploads/message-image";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ attachmentId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const { attachmentId } = await params;
  if (!z.string().cuid().safeParse(attachmentId).success) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  if (!isMessageImageStorageConfigured()) {
    return NextResponse.json({ error: "Photo storage unavailable." }, { status: 503 });
  }

  // Every request checks current conversation access, including both-way
  // blocks and removed participants, even when the attachment ID is known.
  const attachment = await getPrisma().messageAttachment.findFirst({
    select: {
      byteSize: true,
      mimeType: true,
      url: true,
      message: { select: { conversationId: true } },
    },
    where: {
      id: attachmentId,
      status: "APPROVED",
      message: {
        deletedAt: null,
        conversation: buildConversationAccessWhere(user.id),
      },
    },
  });
  if (!attachment ||
      !["image/jpeg", "image/png", "image/webp"].includes(attachment.mimeType) ||
      attachment.byteSize < 1 ||
      attachment.byteSize > 5 * 1024 * 1024 ||
      !isValidStoredMessageImageKey(attachment.url, attachment.message.conversationId)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  try {
    const stored = await downloadMessageImage(attachment.url);
    return new Response(stored.body, {
      status: 200,
      headers: {
        "content-type": attachment.mimeType,
        "cache-control": "private, no-store, max-age=0",
        "content-disposition": "inline",
        "x-content-type-options": "nosniff",
        "vary": "Cookie",
      },
    });
  } catch {
    return NextResponse.json({ error: "Photo temporarily unavailable." }, {
      status: 503,
      headers: { "cache-control": "private, no-store" },
    });
  }
}
