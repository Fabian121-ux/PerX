import { NextResponse } from "next/server";
import { z } from "zod";

import { assertAccountAccessWithClient, assertCanMessage } from "@/lib/account/enforcement";
import { getCurrentSessionTokenHash, getCurrentUser } from "@/lib/auth/session";
import { getPrisma } from "@/lib/db/prisma";
import { getResolvedDataMode, hasDatabaseUrl } from "@/lib/env";
import { buildConversationAccessWhere } from "@/lib/messages/access";
import { lockUserAccount, lockUserPairs } from "@/lib/network/pair-lock";
import {
  deleteMessageImage,
  isMessageImageStorageConfigured,
  uploadMessageImage,
  validateMessageImage,
} from "@/lib/uploads/message-image";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const cuid = z.string().cuid();
const tooMany = "Please slow down before sending more messages.";
const oneMinute = 60_000;
const maxMessagesPerMinute = 20;

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const sessionHash = await getCurrentSessionTokenHash();
  if (!sessionHash) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const restriction = await assertCanMessage(user.id);
  if (restriction) return NextResponse.json({ error: restriction }, { status: 403 });
  if (getResolvedDataMode() === "mock" || !hasDatabaseUrl() || !isMessageImageStorageConfigured()) {
    return NextResponse.json({ error: "Private photo sharing is not configured yet." }, { status: 503 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Choose a valid photo." }, { status: 400 });
  }
  const conversationId = form.get("conversationId");
  const file = form.get("image");
  if (typeof conversationId !== "string" || !cuid.safeParse(conversationId).success ||
      !(file instanceof File)) {
    return NextResponse.json({ error: "Choose a conversation and a photo." }, { status: 400 });
  }
  const checked = await validateMessageImage(file);
  if ("error" in checked) {
    return NextResponse.json({ error: checked.error }, { status: 400 });
  }

  // Reuse the message read predicate, including both-way block restrictions,
  // before uploading any bytes into Storage.
  const db = getPrisma();
  const visible = await db.conversation.findFirst({
    select: { id: true },
    where: { id: conversationId, ...buildConversationAccessWhere(user.id) },
  });
  if (!visible) return NextResponse.json({ error: "Conversation unavailable." }, { status: 404 });
  const recent = await db.message.count({
    where: { senderId: user.id, createdAt: { gte: new Date(Date.now() - oneMinute) } },
  });
  if (recent >= maxMessagesPerMinute) {
    return NextResponse.json({ error: tooMany }, { status: 429 });
  }

  let uploadedKey: string | null = null;
  try {
    uploadedKey = await uploadMessageImage({
      file, extension: checked.extension, conversationId, userId: user.id,
    });
    const key = uploadedKey;
    const result = await db.$transaction(async (tx) => {
      const conversation = await tx.conversation.findFirst({
        include: { participants: true },
        where: { id: conversationId, ...buildConversationAccessWhere(user.id) },
      });
      if (!conversation) return { error: "Conversation unavailable." };
      if (conversation.participants.length !== 2 ||
          conversation.participants.some((participant) => participant.removedAt)) {
        return { error: "Photo sharing requires an active two-person conversation." };
      }
      const partnerId = conversation.participants.find((member) => member.userId !== user.id)?.userId;
      if (!partnerId) return { error: "Conversation unavailable." };
      await lockUserAccount(tx, user.id);
      await lockUserPairs(tx, user.id, [partnerId]);
      const [session, accountError, block, count] = await Promise.all([
        tx.session.findFirst({
          select: { id: true },
          where: {
            userId: user.id, tokenHash: sessionHash, expiresAt: { gt: new Date() },
          },
        }),
        assertAccountAccessWithClient(tx, user.id, "message:send"),
        tx.blockedUser.findFirst({
          select: { id: true },
          where: {
            OR: [
              { blockerUserId: user.id, blockedUserId: partnerId },
              { blockerUserId: partnerId, blockedUserId: user.id },
            ],
          },
        }),
        tx.message.count({
          where: { senderId: user.id, createdAt: { gte: new Date(Date.now() - oneMinute) } },
        }),
      ]);
      if (!session) return { error: "Authentication required." };
      if (accountError) return { error: accountError };
      if (block) return { error: "Conversation unavailable." };
      if (count >= maxMessagesPerMinute) return { error: tooMany };
      if (!conversation.opportunityId) {
        const connection = await tx.connection.findFirst({
          select: { id: true },
          where: {
            status: "ACCEPTED",
            OR: [
              { requesterId: user.id, receiverId: partnerId },
              { requesterId: partnerId, receiverId: user.id },
            ],
          },
        });
        if (!connection) return { error: "Connect before sharing private photos." };
      }
      const message = await tx.message.create({
        data: {
          body: "Photo",
          conversationId,
          senderId: user.id,
          attachments: {
            create: {
              filename: file.name.slice(-120),
              url: key,
              mimeType: file.type,
              byteSize: file.size,
              status: "APPROVED",
            },
          },
        },
        select: { id: true, attachments: { select: { id: true } } },
      });
      await tx.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      });
      await tx.messageReadReceipt.create({
        data: { messageId: message.id, userId: user.id },
      });
      await tx.notification.create({
        data: {
          actionUrl: `/app/messages/${conversationId}?message=${message.id}`,
          body: `${user.name} sent you a photo.`,
          metadata: {
            conversationId, messageId: message.id,
            recipientId: partnerId, senderId: user.id,
          },
          title: "New photo",
          type: "NEW_MESSAGE",
          userId: partnerId,
        },
      });
      await tx.auditLog.create({
        data: {
          action: "message.photo_sent",
          actorId: user.id,
          entityId: message.id,
          entityType: "message",
          metadata: { conversationId, mimeType: file.type, byteSize: file.size },
        },
      });
      return { success: true as const, id: message.id, attachmentId: message.attachments[0]!.id };
    }, { timeout: 10_000 });
    if ("error" in result) {
      await deleteMessageImage(key);
      uploadedKey = null;
      return NextResponse.json({ error: result.error }, { status: 403 });
    }
    return NextResponse.json({
      success: true,
      messageId: result.id,
      image: {
        id: result.attachmentId,
        filename: file.name.slice(-120),
        url: `/api/messages/images/${result.attachmentId}`,
      },
    });
  } catch {
    if (uploadedKey) await deleteMessageImage(uploadedKey);
    return NextResponse.json({ error: "Photo could not be sent. Try again." }, { status: 503 });
  }
}
