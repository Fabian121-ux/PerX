import { getPrisma } from "@/lib/db/prisma";

export type AccountRestrictionState = {
  bannedAt: Date | null;
  connectionRequestsRestrictedUntil: Date | null;
  deactivatedAt: Date | null;
  enforcementReasonPublic: string | null;
  isActive: boolean;
  messagingRestrictedUntil: Date | null;
  publishingRestrictedUntil: Date | null;
  suspendedAt: Date | null;
  suspendedUntil: Date | null;
};

export function isTimedRestrictionActive(value?: Date | null, now = new Date()) {
  return Boolean(value && value.getTime() > now.getTime());
}

export function getRestrictionMessage(state: AccountRestrictionState) {
  if (!state.isActive || state.bannedAt || state.deactivatedAt) {
    return state.enforcementReasonPublic ?? "This account is not currently active.";
  }
  if (state.suspendedAt && (!state.suspendedUntil || state.suspendedUntil > new Date())) {
    return state.enforcementReasonPublic ?? "This account is temporarily restricted.";
  }
  return null;
}

export async function getAccountRestrictionState(userId: string) {
  return getPrisma().user.findUnique({
    select: {
      bannedAt: true,
      connectionRequestsRestrictedUntil: true,
      deactivatedAt: true,
      enforcementReasonPublic: true,
      isActive: true,
      messagingRestrictedUntil: true,
      publishingRestrictedUntil: true,
      suspendedAt: true,
      suspendedUntil: true,
    },
    where: { id: userId },
  });
}

export async function assertCanRequestConnection(userId: string) {
  const state = await getAccountRestrictionState(userId);
  if (!state) return "Account not found.";
  const accountMessage = getRestrictionMessage(state);
  if (accountMessage) return accountMessage;
  if (isTimedRestrictionActive(state.connectionRequestsRestrictedUntil)) {
    return "Connection requests are temporarily restricted for this account.";
  }
  return null;
}

export async function assertCanMessage(userId: string) {
  const state = await getAccountRestrictionState(userId);
  if (!state) return "Account not found.";
  const accountMessage = getRestrictionMessage(state);
  if (accountMessage) return accountMessage;
  if (isTimedRestrictionActive(state.messagingRestrictedUntil)) {
    return "Messaging is temporarily restricted for this account.";
  }
  return null;
}

export async function assertCanPublish(userId: string) {
  const state = await getAccountRestrictionState(userId);
  if (!state) return "Account not found.";
  const accountMessage = getRestrictionMessage(state);
  if (accountMessage) return accountMessage;
  if (isTimedRestrictionActive(state.publishingRestrictedUntil)) {
    return "Publishing is temporarily restricted for this account.";
  }
  return null;
}
