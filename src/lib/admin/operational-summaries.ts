import type { AdminAccountState } from "@/lib/data/providers/interfaces";

export type AdminAccountStateFields = {
  bannedAt: Date | null;
  deactivatedAt: Date | null;
  isActive: boolean;
  suspendedAt: Date | null;
  suspendedUntil: Date | null;
};

export function getAdminAccountState(
  account: AdminAccountStateFields,
  now = new Date(),
): AdminAccountState {
  if (account.bannedAt) return "BANNED";
  if (account.deactivatedAt) return "DEACTIVATED";
  if (!account.isActive) return "INACTIVE";
  if (
    account.suspendedAt &&
    (!account.suspendedUntil || account.suspendedUntil > now)
  ) {
    return "SUSPENDED";
  }
  return "ACTIVE";
}

export function getAdminActiveRestrictions(
  account: {
    connectionRequestsRestrictedUntil: Date | null;
    messagingRestrictedUntil: Date | null;
    publishingRestrictedUntil: Date | null;
  },
  now = new Date(),
) {
  return [
    { kind: "MESSAGING" as const, until: account.messagingRestrictedUntil },
    {
      kind: "CONNECTION_REQUESTS" as const,
      until: account.connectionRequestsRestrictedUntil,
    },
    { kind: "PUBLISHING" as const, until: account.publishingRestrictedUntil },
  ].filter(
    (entry): entry is { kind: (typeof entry)["kind"]; until: Date } =>
      Boolean(entry.until && entry.until > now),
  );
}
