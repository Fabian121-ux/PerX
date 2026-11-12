"use server";

import crypto from "node:crypto";
import { redirect } from "next/navigation";
import { Prisma } from "@/generated/prisma/client";

import { destroySession, getCurrentUser } from "@/lib/auth/session";
import { getPrisma } from "@/lib/db/prisma";
import { getServerEnv, getResolvedDataMode, hasDatabaseUrl } from "@/lib/env";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

export type DeleteAccountState = {
  message?: string;
  status: "idle" | "error";
};

const REMOVED_MESSAGE = "This message was removed after its sender deleted their account.";

async function removeStorageObjects(bucketName: string, keys: string[]) {
  const uniqueKeys = [...new Set(keys.filter(Boolean))];
  if (!uniqueKeys.length) return;

  const env = getServerEnv();
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Account media storage is not configured. Contact support before retrying.");
  }

  const baseUrl = env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "");
  const bucket = encodeURIComponent(bucketName);
  for (let offset = 0; offset < uniqueKeys.length; offset += 1000) {
    const prefixes = uniqueKeys.slice(offset, offset + 1000);
    const response = await fetch(`${baseUrl}/storage/v1/object/${bucket}`, {
      method: "DELETE",
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ prefixes }),
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error("Account data was not changed, but some media may already have been removed. Contact support before retrying.");
    }
  }
}

export async function deleteAccountAction(
  _previousState: DeleteAccountState,
  formData: FormData,
): Promise<DeleteAccountState> {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  if (getResolvedDataMode() !== "database" || !hasDatabaseUrl()) {
    return { status: "error", message: "Account deletion is unavailable in this environment." };
  }

  const password = String(formData.get("password") ?? "");
  const confirmation = String(formData.get("confirmation") ?? "");
  if (confirmation !== "DELETE") {
    return { status: "error", message: 'Type DELETE exactly to confirm account deletion.' };
  }
  if (!password) {
    return { status: "error", message: "Enter your current password to continue." };
  }

  const prisma = getPrisma();
  const account = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      email: true,
      passwordHash: true,
      imageStorageKey: true,
      profile: { select: { profileImageStorageKey: true } },
    },
  });
  if (!account || !(await verifyPassword(password, account.passwordHash))) {
    return { status: "error", message: "The password you entered is incorrect." };
  }

  const [listingImages, messages] = await Promise.all([
    prisma.opportunityImage.findMany({
      where: { uploaderId: user.id },
      select: { id: true, opportunityId: true, storageKey: true, isCover: true },
    }),
    prisma.message.findMany({
      where: { senderId: user.id },
      select: {
        id: true,
        attachments: { select: { url: true } },
      },
    }),
  ]);

  const env = getServerEnv();
  const profileKeys = [account.imageStorageKey, account.profile?.profileImageStorageKey].filter(
    (key): key is string => Boolean(key),
  );
  const listingKeys = listingImages.map((image) => image.storageKey);
  const messageKeys = messages.flatMap((message) =>
    message.attachments.map((attachment) => attachment.url).filter((key) => key.startsWith("messages/")),
  );

  try {
    // Remove uploaded bytes before committing the irreversible account erasure.
    await removeStorageObjects(env.SUPABASE_AVATAR_BUCKET, profileKeys);
    await removeStorageObjects(env.SUPABASE_LISTING_BUCKET, listingKeys);
    await removeStorageObjects(env.SUPABASE_MESSAGE_BUCKET, messageKeys);
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Account media could not be removed.",
    };
  }

  const now = new Date();
  const deletedPasswordHash = await hashPassword(crypto.randomBytes(48).toString("base64url"));
  const messageIds = messages.map((message) => message.id);

  try {
    await prisma.$transaction(async (tx) => {
      await tx.session.deleteMany({ where: { userId: user.id } });
      await tx.passwordResetToken.deleteMany({ where: { userId: user.id } });
      await tx.emailVerificationToken.deleteMany({ where: { userId: user.id } });
      await tx.traderApplication.deleteMany({ where: { userId: user.id } });
      await tx.userRole.deleteMany({ where: { userId: user.id } });
      await tx.notification.deleteMany({ where: { userId: user.id } });
      await tx.broadcastDelivery.deleteMany({ where: { userId: user.id } });
      await tx.connection.deleteMany({
        where: { OR: [{ requesterId: user.id }, { receiverId: user.id }] },
      });
      await tx.blockedUser.deleteMany({
        where: { OR: [{ blockerUserId: user.id }, { blockedUserId: user.id }] },
      });
      await tx.opportunityBookmark.deleteMany({ where: { userId: user.id } });
      await tx.profileBookmark.deleteMany({ where: { userId: user.id } });
      await tx.postReaction.deleteMany({ where: { userId: user.id } });
      await tx.messageReadReceipt.deleteMany({ where: { userId: user.id } });
      await tx.opportunityReport.deleteMany({ where: { reporterId: user.id } });
      await tx.userReport.deleteMany({ where: { reporterId: user.id } });
      await tx.supportTicket.deleteMany({ where: { authorId: user.id } });
      await tx.ticketMessage.deleteMany({ where: { senderId: user.id } });
      await tx.trustSignal.deleteMany({ where: { userId: user.id } });

      if (messageIds.length) {
        await tx.messageEdit.deleteMany({ where: { messageId: { in: messageIds } } });
        await tx.messageAttachment.deleteMany({ where: { messageId: { in: messageIds } } });
      }
      await tx.message.updateMany({
        where: { senderId: user.id },
        data: { body: REMOVED_MESSAGE, deletedAt: now, editedAt: null },
      });

      await tx.post.updateMany({
        where: { authorId: user.id },
        data: { body: "[Post removed after account deletion]", deletedAt: now },
      });
      await tx.postComment.updateMany({
        where: { authorId: user.id },
        data: { body: "[Comment removed after account deletion]", deletedAt: now },
      });

      await tx.opportunityImage.deleteMany({ where: { uploaderId: user.id } });
      await tx.opportunity.updateMany({
        where: { ownerId: user.id },
        data: { status: "ARCHIVED", archivedAt: now, pausedAt: now },
      });

      await tx.profile.deleteMany({ where: { userId: user.id } });
      await tx.auditLog.updateMany({
        where: { actorId: user.id },
        data: {
          actorId: null,
          ipAddress: null,
          userAgent: null,
          metadata: Prisma.DbNull,
        },
      });

      // Keep shared conversations, proposals, and deal/settlement records intact.
      // The old user row becomes a non-authenticating, non-identifying tombstone.
      await tx.user.update({
        where: { id: user.id },
        data: {
          email: `deleted+${user.id}@accounts.prex.invalid`,
          username: `deleted-${user.id}`,
          name: "Deleted member",
          passwordHash: deletedPasswordHash,
          imageUrl: null,
          imageStorageKey: null,
          emailVerifiedAt: null,
          verificationStatus: "UNVERIFIED",
          isActive: false,
          deactivatedAt: now,
          onboardingDismissedAt: null,
          messagingRestrictedUntil: null,
          connectionRequestsRestrictedUntil: null,
          publishingRestrictedUntil: null,
          suspendedAt: null,
          suspendedUntil: null,
          bannedAt: null,
          enforcementReasonPublic: null,
        },
      });
    }, { timeout: 20_000 });
  } catch {
    return {
      status: "error",
      message: "The account record could not be anonymised. Your account remains active, but uploaded media may already have been removed. Contact support before retrying.",
    };
  }

  await destroySession();
  redirect("/sign-in?accountDeleted=1");
}
