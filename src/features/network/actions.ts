"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getPrisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/logging/audit";

type PairLockClient = {
  $executeRawUnsafe: (query: string, ...values: unknown[]) => Promise<unknown>;
};

function pairKey(a: string, b: string) {
  return [a, b].sort().join(":");
}

async function lockUserPair(tx: PairLockClient, a: string, b: string) {
  await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1))", pairKey(a, b));
}

async function hasBlockBetween(a: string, b: string) {
  const block = await getPrisma().blockedUser.findFirst({
    where: {
      OR: [
        { blockerUserId: a, blockedUserId: b },
        { blockerUserId: b, blockedUserId: a },
      ],
    },
  });
  return Boolean(block);
}

export async function requestConnectionAction(targetUserId: string) {
  const user = await requireUser();

  if (user.id === targetUserId) {
    throw new Error("Cannot connect with yourself");
  }

  await getPrisma().$transaction(async (tx) => {
    await lockUserPair(tx, user.id, targetUserId);

    const target = await tx.user.findFirst({
      select: {
        id: true,
        profile: { select: { allowConnectionRequests: true } },
      },
      where: {
        accountClassification: "PUBLIC_BETA_USER",
        id: targetUserId,
        isActive: true,
      },
    });

    if (!target || !target.profile?.allowConnectionRequests) {
      throw new Error("Connection request is unavailable.");
    }

    const block = await tx.blockedUser.findFirst({
      where: {
        OR: [
          { blockerUserId: user.id, blockedUserId: targetUserId },
          { blockerUserId: targetUserId, blockedUserId: user.id },
        ],
      },
    });
    if (block) throw new Error("Connection request is unavailable.");

    const existing = await tx.connection.findFirst({
      where: {
        OR: [
          { requesterId: user.id, receiverId: targetUserId },
          { requesterId: targetUserId, receiverId: user.id },
        ],
      },
    });

    if (existing?.status === "PENDING" || existing?.status === "ACCEPTED") {
      return;
    }

    if (existing) {
      await tx.connection.update({
        data: {
          requesterId: user.id,
          receiverId: targetUserId,
          status: "PENDING",
        },
        where: { id: existing.id },
      });
    } else {
      await tx.connection.create({
        data: {
          requesterId: user.id,
          receiverId: targetUserId,
          status: "PENDING",
        },
      });
    }

    await tx.notification.create({
      data: {
        body: `${user.name} sent you a connection request.`,
        title: "New connection request",
        type: "CONNECTION",
        userId: targetUserId,
      },
    });
  });

  await writeAuditLog({
    actorId: user.id,
    action: "connection.request",
    entityId: targetUserId,
    entityType: "user",
  });
  revalidatePath("/app/people");
  revalidatePath("/app/network");
  revalidatePath("/app/connections");
}

export async function acceptConnectionAction(connectionId: string) {
  const user = await requireUser();

  const connection = await getPrisma().connection.findUnique({
    where: { id: connectionId },
  });

  if (!connection) throw new Error("Connection not found");
  if (connection.receiverId !== user.id) throw new Error("Unauthorized");

  await getPrisma().$transaction(async (tx) => {
    await tx.connection.update({
      where: { id: connectionId },
      data: { status: "ACCEPTED" },
    });
    await tx.notification.create({
      data: {
        body: `${user.name} accepted your connection request.`,
        title: "Connection accepted",
        type: "CONNECTION",
        userId: connection.requesterId,
      },
    });
  });

  await writeAuditLog({
    actorId: user.id,
    action: "connection.accept",
    entityId: connectionId,
    entityType: "connection",
  });
  revalidatePath("/app/people");
  revalidatePath("/app/network");
  revalidatePath("/app/connections");
}

export async function rejectConnectionAction(connectionId: string) {
  const user = await requireUser();

  const connection = await getPrisma().connection.findUnique({
    where: { id: connectionId },
  });

  if (!connection) throw new Error("Connection not found");
  if (connection.receiverId !== user.id && connection.requesterId !== user.id) {
    throw new Error("Unauthorized");
  }

  await getPrisma().connection.update({
    where: { id: connectionId },
    data: { status: "DECLINED" },
  });

  await writeAuditLog({
    actorId: user.id,
    action: "connection.decline",
    entityId: connectionId,
    entityType: "connection",
  });
  revalidatePath("/app/people");
  revalidatePath("/app/network");
  revalidatePath("/app/connections");
}

export async function disconnectAction(connectionId: string) {
  const user = await requireUser();

  const connection = await getPrisma().connection.findUnique({
    where: { id: connectionId },
  });

  if (!connection) throw new Error("Connection not found");
  if (connection.receiverId !== user.id && connection.requesterId !== user.id) {
    throw new Error("Unauthorized");
  }

  await getPrisma().connection.update({
    where: { id: connectionId },
    data: { status: "CANCELLED" },
  });

  await writeAuditLog({
    actorId: user.id,
    action: "connection.remove",
    entityId: connectionId,
    entityType: "connection",
  });
  revalidatePath("/app/people");
  revalidatePath("/app/network");
  revalidatePath("/app/connections");
}

export async function blockUserAction(targetUserId: string) {
  const user = await requireUser();
  if (user.id === targetUserId) throw new Error("Cannot block yourself");

  await getPrisma().$transaction(async (tx) => {
    await lockUserPair(tx, user.id, targetUserId);
    await tx.blockedUser.upsert({
      create: { blockedUserId: targetUserId, blockerUserId: user.id },
      update: {},
      where: {
        blockerUserId_blockedUserId: {
          blockedUserId: targetUserId,
          blockerUserId: user.id,
        },
      },
    });
    await tx.connection.updateMany({
      data: { status: "BLOCKED" },
      where: {
        OR: [
          { requesterId: user.id, receiverId: targetUserId },
          { requesterId: targetUserId, receiverId: user.id },
        ],
      },
    });
  });

  await writeAuditLog({
    actorId: user.id,
    action: "user.block",
    entityId: targetUserId,
    entityType: "user",
  });
  revalidatePath("/app/people");
  revalidatePath("/app/network");
  revalidatePath("/app/connections");
}

export async function unblockUserAction(targetUserId: string) {
  const user = await requireUser();
  if (user.id === targetUserId) throw new Error("Cannot unblock yourself");

  await getPrisma().blockedUser.deleteMany({
    where: { blockedUserId: targetUserId, blockerUserId: user.id },
  });

  await writeAuditLog({
    actorId: user.id,
    action: "user.unblock",
    entityId: targetUserId,
    entityType: "user",
  });
  revalidatePath("/app/people");
  revalidatePath("/app/network");
  revalidatePath("/app/connections");
}

export async function startConversationAction(targetUserId: string) {
  const user = await requireUser();

  if (user.id === targetUserId) {
    throw new Error("Cannot message yourself");
  }

  if (await hasBlockBetween(user.id, targetUserId)) {
    throw new Error("Messaging is unavailable.");
  }

  const targetUser = await getPrisma().user.findFirst({
    select: {
      id: true,
      profile: {
        select: {
          allowMessagesFromConnections: true,
          allowMessagesFromMembers: true,
        },
      },
    },
    where: {
      accountClassification: "PUBLIC_BETA_USER",
      id: targetUserId,
      isActive: true,
    },
  });

  if (!targetUser) {
    throw new Error("User not found");
  }

  const acceptedConnection = await getPrisma().connection.findFirst({
    where: {
      status: "ACCEPTED",
      OR: [
        { requesterId: user.id, receiverId: targetUserId },
        { requesterId: targetUserId, receiverId: user.id },
      ],
    },
  });

  const messageAllowed =
    (acceptedConnection && targetUser.profile?.allowMessagesFromConnections) ||
    targetUser.profile?.allowMessagesFromMembers;

  if (!messageAllowed) {
    throw new Error("Messaging is unavailable.");
  }

  const conversation = await getPrisma().$transaction(async (tx) => {
    await lockUserPair(tx, user.id, targetUserId);

    const possibleConversations = await tx.conversation.findMany({
      include: { participants: true },
      where: {
        opportunityId: null,
        AND: [
          { participants: { some: { userId: user.id } } },
          { participants: { some: { userId: targetUserId } } },
        ],
      },
    });

    const existingConversation = possibleConversations.find(
      (conversation) => conversation.participants.length === 2,
    );
    if (existingConversation) return { id: existingConversation.id };

    return tx.conversation.create({
      data: {
        participants: {
          create: [{ userId: user.id }, { userId: targetUserId }],
        },
      },
      select: { id: true },
    });
  });

  await writeAuditLog({
    actorId: user.id,
    action: "conversation.direct_started",
    entityId: conversation.id,
    entityType: "conversation",
    metadata: { participantCount: 2 },
  });

  revalidatePath("/app/messages");
  redirect(`/app/messages/${conversation.id}`);
}
