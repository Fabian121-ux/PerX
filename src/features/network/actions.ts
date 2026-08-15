"use server";

import type { Prisma } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getPrisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/session";
import {
  assertAccountAccess,
  assertCanMessage,
} from "@/lib/account/enforcement";
import { assertCanRequestConnection } from "@/lib/account/enforcement";
import { writeAuditLog } from "@/lib/logging/audit";
import { lockUserPair } from "@/lib/network/pair-lock";
import {
  isDiscoverableNetworkTarget,
  isEligibleNetworkAccount,
  networkAccountEligibilitySelect,
  type NetworkAccountSnapshot,
} from "./eligibility";

async function getNetworkPairAccounts(
  tx: Pick<Prisma.TransactionClient, "user">,
  actorId: string,
  targetId: string,
) {
  const accounts = await tx.user.findMany({
    select: networkAccountEligibilitySelect,
    take: 2,
    where: { id: { in: [actorId, targetId] } },
  });

  return {
    actor: accounts.find((account) => account.id === actorId),
    target: accounts.find((account) => account.id === targetId),
  };
}

function assertEligibleConnectionPair(
  accounts: {
    actor?: NetworkAccountSnapshot;
    target?: NetworkAccountSnapshot;
  },
  options: { targetAllowsRequests?: boolean } = {},
) {
  const now = new Date();
  if (
    !isDiscoverableNetworkTarget(accounts.actor, now) ||
    !isDiscoverableNetworkTarget(accounts.target, now) ||
    (options.targetAllowsRequests &&
      !accounts.target?.profile?.allowConnectionRequests)
  ) {
    throw new Error("Connection action is unavailable.");
  }
}

function assertEligibleAccountPair(accounts: {
  actor?: NetworkAccountSnapshot;
  target?: NetworkAccountSnapshot;
}) {
  const now = new Date();
  if (
    !isEligibleNetworkAccount(accounts.actor, now) ||
    !isEligibleNetworkAccount(accounts.target, now)
  ) {
    throw new Error("Connection action is unavailable.");
  }
}

function revalidateConnectionPaths(
  options: {
    blocked?: boolean;
    messages?: boolean;
    notifications?: boolean;
  } = {},
) {
  revalidatePath("/app/connections");
  revalidatePath("/app/network");
  revalidatePath("/app/people");
  if (options.blocked) revalidatePath("/app/settings/blocked");
  if (options.messages) revalidatePath("/app/messages");
  if (options.notifications) revalidatePath("/app/notifications");
}

type DirectMessageAccount = {
  accountClassification: string;
  bannedAt: Date | null;
  deactivatedAt: Date | null;
  id: string;
  isActive: boolean;
  messagingRestrictedUntil: Date | null;
  profile: { allowMessagesFromConnections: boolean } | null;
  suspendedAt: Date | null;
  suspendedUntil: Date | null;
};

function isEligibleForDirectMessaging(
  account: DirectMessageAccount,
  now: Date,
) {
  const suspended =
    account.suspendedAt &&
    (!account.suspendedUntil || account.suspendedUntil > now);

  return (
    account.accountClassification === "PUBLIC_BETA_USER" &&
    account.isActive &&
    !account.bannedAt &&
    !account.deactivatedAt &&
    !suspended &&
    (!account.messagingRestrictedUntil ||
      account.messagingRestrictedUntil <= now)
  );
}

export async function requestConnectionAction(targetUserId: string) {
  const user = await requireUser();
  const restriction = await assertCanRequestConnection(user.id);
  if (restriction) throw new Error(restriction);

  if (user.id === targetUserId) {
    throw new Error("Cannot connect with yourself");
  }

  const changed = await getPrisma().$transaction(async (tx) => {
    await lockUserPair(tx, user.id, targetUserId);

    const accounts = await getNetworkPairAccounts(tx, user.id, targetUserId);
    assertEligibleConnectionPair(accounts, { targetAllowsRequests: true });

    const [block, existingConnections] = await Promise.all([
      tx.blockedUser.findFirst({
        select: { id: true },
        where: {
          OR: [
            { blockerUserId: user.id, blockedUserId: targetUserId },
            { blockerUserId: targetUserId, blockedUserId: user.id },
          ],
        },
      }),
      tx.connection.findMany({
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: {
          id: true,
          receiverId: true,
          requesterId: true,
          status: true,
        },
        take: 2,
        where: {
          OR: [
            { requesterId: user.id, receiverId: targetUserId },
            { requesterId: targetUserId, receiverId: user.id },
          ],
        },
      }),
    ]);
    if (block) throw new Error("Connection request is unavailable.");
    if (existingConnections.length > 1) {
      throw new Error("Connection request is unavailable.");
    }

    const existing = existingConnections[0];
    if (existing?.status === "ACCEPTED") return false;
    if (existing?.status === "PENDING") {
      if (existing.requesterId === user.id) return false;
      throw new Error("Respond to the existing connection request instead.");
    }
    if (existing?.status === "BLOCKED") {
      throw new Error("Connection request is unavailable.");
    }

    const connection = existing
      ? await tx.connection.update({
          data: {
            requesterId: user.id,
            receiverId: targetUserId,
            status: "PENDING",
          },
          where: { id: existing.id },
        })
      : await tx.connection.create({
          data: {
            requesterId: user.id,
            receiverId: targetUserId,
            status: "PENDING",
          },
        });

    await tx.notification.create({
      data: {
        actionUrl: "/app/connections?tab=requests",
        body: `${user.name} sent you a connection request.`,
        metadata: { actorId: user.id, connectionId: connection.id },
        title: "New connection request",
        type: "CONNECTION_REQUEST_RECEIVED",
        userId: targetUserId,
      },
    });
    return true;
  });

  if (changed) {
    await writeAuditLog({
      actorId: user.id,
      action: "connection.request",
      entityId: targetUserId,
      entityType: "user",
    });
  }
  revalidateConnectionPaths({ notifications: true });
}

export async function acceptConnectionAction(connectionId: string) {
  const user = await requireUser();

  await getPrisma().$transaction(async (tx) => {
    const candidate = await tx.connection.findUnique({
      select: {
        id: true,
        receiverId: true,
        requesterId: true,
        status: true,
      },
      where: { id: connectionId },
    });
    if (!candidate) throw new Error("Connection not found");
    if (candidate.receiverId !== user.id) throw new Error("Unauthorized");
    if (candidate.requesterId === candidate.receiverId) {
      throw new Error("Connection request is no longer available.");
    }

    await lockUserPair(tx, candidate.requesterId, candidate.receiverId);
    const accounts = await getNetworkPairAccounts(
      tx,
      user.id,
      candidate.requesterId,
    );
    assertEligibleConnectionPair(accounts);

    const [block, current, pairConnections] = await Promise.all([
      tx.blockedUser.findFirst({
        select: { id: true },
        where: {
          OR: [
            {
              blockerUserId: candidate.requesterId,
              blockedUserId: candidate.receiverId,
            },
            {
              blockerUserId: candidate.receiverId,
              blockedUserId: candidate.requesterId,
            },
          ],
        },
      }),
      tx.connection.findUnique({
        select: {
          id: true,
          receiverId: true,
          requesterId: true,
          status: true,
        },
        where: { id: connectionId },
      }),
      tx.connection.findMany({
        select: { id: true },
        take: 2,
        where: {
          OR: [
            {
              requesterId: candidate.requesterId,
              receiverId: candidate.receiverId,
            },
            {
              requesterId: candidate.receiverId,
              receiverId: candidate.requesterId,
            },
          ],
        },
      }),
    ]);
    if (
      block ||
      !current ||
      current.status !== "PENDING" ||
      current.receiverId !== user.id ||
      pairConnections.length !== 1
    ) {
      throw new Error("Connection request is no longer available.");
    }

    await tx.connection.update({
      data: { status: "ACCEPTED" },
      where: { id: connectionId },
    });

    await tx.notification.updateMany({
      data: { actionState: "ACCEPTED", readAt: new Date() },
      where: {
        OR: [
          { metadata: { path: ["connectionId"], equals: connectionId } },
          {
            metadata: { path: ["actorId"], equals: candidate.requesterId },
            type: "CONNECTION_REQUEST_RECEIVED",
          },
        ],
        type: "CONNECTION_REQUEST_RECEIVED",
        userId: user.id,
      },
    });

    const existingNotification = await tx.notification.findFirst({
      select: { id: true },
      where: {
        metadata: { path: ["connectionId"], equals: connectionId },
        type: "CONNECTION_REQUEST_ACCEPTED",
        userId: candidate.requesterId,
      },
    });

    if (!existingNotification) {
      await tx.notification.create({
        data: {
          actionUrl: "/app/connections?tab=connections",
          body: `${user.name} accepted your connection request.`,
          metadata: { actorId: user.id, connectionId },
          title: "Connection accepted",
          type: "CONNECTION_REQUEST_ACCEPTED",
          userId: candidate.requesterId,
        },
      });
    }

    return candidate;
  });

  await writeAuditLog({
    actorId: user.id,
    action: "connection.accept",
    entityId: connectionId,
    entityType: "connection",
  });
  revalidateConnectionPaths({ notifications: true });
}

export async function rejectConnectionAction(connectionId: string) {
  const user = await requireUser();

  await getPrisma().$transaction(async (tx) => {
    const candidate = await tx.connection.findUnique({
      select: {
        id: true,
        receiverId: true,
        requesterId: true,
        status: true,
      },
      where: { id: connectionId },
    });
    if (!candidate) throw new Error("Connection not found");
    if (candidate.receiverId !== user.id) throw new Error("Unauthorized");
    if (candidate.requesterId === candidate.receiverId) {
      throw new Error("Connection request is no longer available.");
    }

    await lockUserPair(tx, candidate.requesterId, candidate.receiverId);
    const accounts = await getNetworkPairAccounts(
      tx,
      user.id,
      candidate.requesterId,
    );
    assertEligibleConnectionPair(accounts);

    const [block, current, pairConnections] = await Promise.all([
      tx.blockedUser.findFirst({
        select: { id: true },
        where: {
          OR: [
            {
              blockerUserId: candidate.requesterId,
              blockedUserId: candidate.receiverId,
            },
            {
              blockerUserId: candidate.receiverId,
              blockedUserId: candidate.requesterId,
            },
          ],
        },
      }),
      tx.connection.findUnique({
        select: {
          receiverId: true,
          requesterId: true,
          status: true,
        },
        where: { id: connectionId },
      }),
      tx.connection.findMany({
        select: { id: true },
        take: 2,
        where: {
          OR: [
            {
              requesterId: candidate.requesterId,
              receiverId: candidate.receiverId,
            },
            {
              requesterId: candidate.receiverId,
              receiverId: candidate.requesterId,
            },
          ],
        },
      }),
    ]);
    if (
      block ||
      !current ||
      current.status !== "PENDING" ||
      current.receiverId !== user.id ||
      pairConnections.length !== 1
    ) {
      throw new Error("Connection request is no longer available.");
    }

    await tx.connection.update({
      data: { status: "DECLINED" },
      where: { id: connectionId },
    });

    await tx.notification.updateMany({
      data: { actionState: "DECLINED", readAt: new Date() },
      where: {
        OR: [
          { metadata: { path: ["connectionId"], equals: connectionId } },
          {
            metadata: { path: ["actorId"], equals: candidate.requesterId },
            type: "CONNECTION_REQUEST_RECEIVED",
          },
        ],
        type: "CONNECTION_REQUEST_RECEIVED",
        userId: user.id,
      },
    });

    const existingNotification = await tx.notification.findFirst({
      select: { id: true },
      where: {
        metadata: { path: ["connectionId"], equals: connectionId },
        type: "CONNECTION_REQUEST_DECLINED",
        userId: candidate.requesterId,
      },
    });

    if (!existingNotification) {
      await tx.notification.create({
        data: {
          actionUrl: "/app/connections?tab=sent",
          body: `${user.name} declined a connection request.`,
          metadata: { actorId: user.id, connectionId },
          title: "Connection request declined",
          type: "CONNECTION_REQUEST_DECLINED",
          userId: candidate.requesterId,
        },
      });
    }
  });

  await writeAuditLog({
    actorId: user.id,
    action: "connection.decline",
    entityId: connectionId,
    entityType: "connection",
  });
  revalidateConnectionPaths({ notifications: true });
}

export async function cancelConnectionRequestAction(connectionId: string) {
  const user = await requireUser();

  await getPrisma().$transaction(async (tx) => {
    const candidate = await tx.connection.findUnique({
      select: {
        id: true,
        receiverId: true,
        requesterId: true,
        status: true,
      },
      where: { id: connectionId },
    });
    if (!candidate) throw new Error("Connection not found");
    if (candidate.requesterId !== user.id) throw new Error("Unauthorized");
    if (candidate.requesterId === candidate.receiverId) {
      throw new Error("Connection request is no longer available.");
    }

    await lockUserPair(tx, candidate.requesterId, candidate.receiverId);
    const accounts = await getNetworkPairAccounts(
      tx,
      user.id,
      candidate.receiverId,
    );
    assertEligibleAccountPair(accounts);

    const [block, current, pairConnections] = await Promise.all([
      tx.blockedUser.findFirst({
        select: { id: true },
        where: {
          OR: [
            {
              blockerUserId: candidate.requesterId,
              blockedUserId: candidate.receiverId,
            },
            {
              blockerUserId: candidate.receiverId,
              blockedUserId: candidate.requesterId,
            },
          ],
        },
      }),
      tx.connection.findUnique({
        select: {
          receiverId: true,
          requesterId: true,
          status: true,
        },
        where: { id: connectionId },
      }),
      tx.connection.findMany({
        select: { id: true },
        take: 2,
        where: {
          OR: [
            {
              requesterId: candidate.requesterId,
              receiverId: candidate.receiverId,
            },
            {
              requesterId: candidate.receiverId,
              receiverId: candidate.requesterId,
            },
          ],
        },
      }),
    ]);
    if (
      block ||
      !current ||
      current.status !== "PENDING" ||
      current.requesterId !== user.id ||
      pairConnections.length !== 1
    ) {
      throw new Error("Connection request is no longer available.");
    }

    await tx.connection.update({
      data: { status: "CANCELLED" },
      where: { id: connectionId },
    });
    await tx.notification.updateMany({
      data: { actionState: "CANCELLED", readAt: new Date() },
      where: {
        metadata: { path: ["connectionId"], equals: connectionId },
        type: "CONNECTION_REQUEST_RECEIVED",
        userId: candidate.receiverId,
      },
    });
  });

  await writeAuditLog({
    actorId: user.id,
    action: "connection.cancel",
    entityId: connectionId,
    entityType: "connection",
  });
  revalidateConnectionPaths({ notifications: true });
}

export async function disconnectAction(connectionId: string) {
  const user = await requireUser();

  await getPrisma().$transaction(async (tx) => {
    const candidate = await tx.connection.findUnique({
      select: {
        id: true,
        receiverId: true,
        requesterId: true,
        status: true,
      },
      where: { id: connectionId },
    });
    if (!candidate) throw new Error("Connection not found");
    if (candidate.receiverId !== user.id && candidate.requesterId !== user.id) {
      throw new Error("Unauthorized");
    }
    if (candidate.requesterId === candidate.receiverId) {
      throw new Error("Connection is no longer available.");
    }

    const targetUserId =
      candidate.requesterId === user.id
        ? candidate.receiverId
        : candidate.requesterId;
    await lockUserPair(tx, user.id, targetUserId);
    const accounts = await getNetworkPairAccounts(tx, user.id, targetUserId);
    assertEligibleAccountPair(accounts);

    const [block, current, pairConnections] = await Promise.all([
      tx.blockedUser.findFirst({
        select: { id: true },
        where: {
          OR: [
            { blockerUserId: user.id, blockedUserId: targetUserId },
            { blockerUserId: targetUserId, blockedUserId: user.id },
          ],
        },
      }),
      tx.connection.findUnique({
        select: { status: true },
        where: { id: connectionId },
      }),
      tx.connection.findMany({
        select: { id: true },
        take: 2,
        where: {
          OR: [
            { requesterId: user.id, receiverId: targetUserId },
            { requesterId: targetUserId, receiverId: user.id },
          ],
        },
      }),
    ]);
    if (
      block ||
      current?.status !== "ACCEPTED" ||
      pairConnections.length !== 1
    ) {
      throw new Error("Connection is no longer available.");
    }

    await tx.connection.update({
      data: { status: "CANCELLED" },
      where: { id: connectionId },
    });
  });

  await writeAuditLog({
    actorId: user.id,
    action: "connection.remove",
    entityId: connectionId,
    entityType: "connection",
  });
  revalidateConnectionPaths({ blocked: true, messages: true });
}

export async function blockUserAction(targetUserId: string) {
  const user = await requireUser();
  const accountRestriction = await assertAccountAccess(user.id, "block");
  if (accountRestriction) throw new Error(accountRestriction);
  if (user.id === targetUserId) throw new Error("Cannot block yourself");

  await getPrisma().$transaction(async (tx) => {
    await lockUserPair(tx, user.id, targetUserId);
    const accounts = await getNetworkPairAccounts(tx, user.id, targetUserId);
    assertEligibleAccountPair(accounts);

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
  revalidateConnectionPaths({
    blocked: true,
    messages: true,
    notifications: true,
  });
}

export async function unblockUserAction(targetUserId: string) {
  const user = await requireUser();
  if (user.id === targetUserId) throw new Error("Cannot unblock yourself");

  await getPrisma().$transaction(async (tx) => {
    await lockUserPair(tx, user.id, targetUserId);
    await tx.blockedUser.deleteMany({
      where: { blockedUserId: targetUserId, blockerUserId: user.id },
    });
    const reciprocalBlock = await tx.blockedUser.findFirst({
      select: { id: true },
      where: { blockedUserId: user.id, blockerUserId: targetUserId },
    });
    if (!reciprocalBlock) {
      await tx.connection.updateMany({
        data: { status: "CANCELLED" },
        where: {
          OR: [
            { requesterId: user.id, receiverId: targetUserId },
            { requesterId: targetUserId, receiverId: user.id },
          ],
          status: "BLOCKED",
        },
      });
    }
  });

  await writeAuditLog({
    actorId: user.id,
    action: "user.unblock",
    entityId: targetUserId,
    entityType: "user",
  });
  revalidateConnectionPaths({ blocked: true });
}

export async function startConversationAction(targetUserId: string) {
  const user = await requireUser();
  const accountRestriction = await assertCanMessage(user.id);
  if (accountRestriction) throw new Error(accountRestriction);

  if (user.id === targetUserId) {
    throw new Error("Cannot message yourself");
  }

  const conversation = await getPrisma().$transaction(async (tx) => {
    await lockUserPair(tx, user.id, targetUserId);

    const accounts = await tx.user.findMany({
      select: {
        accountClassification: true,
        bannedAt: true,
        deactivatedAt: true,
        id: true,
        isActive: true,
        messagingRestrictedUntil: true,
        profile: { select: { allowMessagesFromConnections: true } },
        suspendedAt: true,
        suspendedUntil: true,
      },
      where: { id: { in: [user.id, targetUserId] } },
    });
    const actor = accounts.find((account) => account.id === user.id);
    const target = accounts.find((account) => account.id === targetUserId);
    const now = new Date();

    if (
      !actor ||
      !target ||
      !isEligibleForDirectMessaging(actor, now) ||
      !isEligibleForDirectMessaging(target, now) ||
      !target.profile?.allowMessagesFromConnections
    ) {
      throw new Error("Messaging is unavailable.");
    }

    const [block, acceptedConnection] = await Promise.all([
      tx.blockedUser.findFirst({
        select: { id: true },
        where: {
          OR: [
            { blockerUserId: user.id, blockedUserId: targetUserId },
            { blockerUserId: targetUserId, blockedUserId: user.id },
          ],
        },
      }),
      tx.connection.findFirst({
        select: { id: true },
        where: {
          status: "ACCEPTED",
          OR: [
            { requesterId: user.id, receiverId: targetUserId },
            { requesterId: targetUserId, receiverId: user.id },
          ],
        },
      }),
    ]);

    if (block || !acceptedConnection) {
      throw new Error("Messaging is unavailable.");
    }

    const directConversations = await tx.conversation.findMany({
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: { id: true, status: true },
      where: {
        opportunityId: null,
        AND: [
          { participants: { some: { userId: user.id } } },
          { participants: { some: { userId: targetUserId } } },
          {
            participants: {
              every: { userId: { in: [user.id, targetUserId] } },
            },
          },
        ],
      },
    });

    const existingConversation =
      directConversations.find((candidate) => candidate.status === "ACTIVE") ??
      directConversations.find((candidate) => candidate.status === "ARCHIVED");
    if (existingConversation?.status === "ACTIVE") {
      await tx.conversationParticipant.updateMany({
        data: { removedAt: null },
        where: { conversationId: existingConversation.id, userId: user.id },
      });
      return { id: existingConversation.id };
    }
    if (existingConversation?.status === "ARCHIVED") {
      const reactivated = await tx.conversation.update({
        data: { status: "ACTIVE" },
        select: { id: true },
        where: { id: existingConversation.id },
      });
      await tx.conversationParticipant.updateMany({
        data: { removedAt: null },
        where: { conversationId: existingConversation.id, userId: user.id },
      });
      return reactivated;
    }
    if (directConversations.length) {
      throw new Error("Messaging is unavailable.");
    }

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
