import type { Prisma } from "@/generated/prisma/client";

export const networkAccountEligibilitySelect = {
  accountClassification: true,
  bannedAt: true,
  deactivatedAt: true,
  id: true,
  isActive: true,
  profile: {
    select: {
      allowConnectionRequests: true,
      allowMessagesFromConnections: true,
      isDiscoverable: true,
    },
  },
  suspendedAt: true,
  suspendedUntil: true,
} satisfies Prisma.UserSelect;

export type NetworkAccountSnapshot = Prisma.UserGetPayload<{
  select: typeof networkAccountEligibilitySelect;
}>;

export function isEligibleNetworkAccount(
  account: NetworkAccountSnapshot | null | undefined,
  now = new Date(),
) {
  if (!account) return false;

  const isSuspended = Boolean(
    account.suspendedAt &&
      (!account.suspendedUntil || account.suspendedUntil > now),
  );

  return (
    account.accountClassification === "PUBLIC_BETA_USER" &&
    account.isActive &&
    !account.bannedAt &&
    !account.deactivatedAt &&
    !isSuspended
  );
}

export function isDiscoverableNetworkTarget(
  account: NetworkAccountSnapshot | null | undefined,
  now = new Date(),
) {
  return Boolean(
    isEligibleNetworkAccount(account, now) && account?.profile?.isDiscoverable,
  );
}

export function getEligibleNetworkUserWhere(
  now = new Date(),
): Prisma.UserWhereInput {
  return {
    accountClassification: "PUBLIC_BETA_USER",
    bannedAt: null,
    deactivatedAt: null,
    isActive: true,
    OR: [
      { suspendedAt: null },
      { suspendedAt: { not: null }, suspendedUntil: { lte: now } },
    ],
  };
}

export function getDiscoverableNetworkTargetWhere(
  viewerId: string,
  now = new Date(),
): Prisma.UserWhereInput {
  return {
    ...getEligibleNetworkUserWhere(now),
    blocksMade: { none: { blockedUserId: viewerId } },
    blocksReceived: { none: { blockerUserId: viewerId } },
    id: { not: viewerId },
    profile: { is: { isDiscoverable: true } },
  };
}
