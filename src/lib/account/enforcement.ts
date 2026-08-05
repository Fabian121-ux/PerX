import { getPrisma } from "@/lib/db/prisma";
import type {
  EnforcementActionStatus,
  EnforcementActionType,
} from "@/generated/prisma/enums";

export type AccountAccessOperation =
  | "admin"
  | "application"
  | "authenticate"
  | "block"
  | "connect"
  | "deal"
  | "message:read"
  | "message:send"
  | "profile"
  | "publish"
  | "report";

export type AccountAccessCode =
  | "banned"
  | "connection-restricted"
  | "deactivated"
  | "inactive"
  | "messaging-restricted"
  | "publishing-restricted"
  | "suspended"
  | "verification-required"
  | null;

export type ActiveEnforcement = {
  createdAt?: Date;
  expiresAt: Date | null;
  status: EnforcementActionStatus;
  type: EnforcementActionType;
};

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
  verificationStatus?: string | null;
  activeEnforcements?: ActiveEnforcement[];
};

export type AccountAccessPolicy = {
  canAccessApplication: boolean;
  canAdminister: boolean;
  canAuthenticate: boolean;
  canBlock: boolean;
  canConnect: boolean;
  canCreateDeal: boolean;
  canEditProfile: boolean;
  canPublish: boolean;
  canReadMessages: boolean;
  canReport: boolean;
  canSendMessages: boolean;
  expiresAt: Date | null;
  publicExplanation: string | null;
  reasonCode: AccountAccessCode;
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

function activeEnforcement(
  state: AccountRestrictionState,
  type: EnforcementActionType,
  now: Date,
) {
  return (state.activeEnforcements ?? []).some(
    (enforcement) =>
      enforcement.type === type &&
      enforcement.status === "ACTIVE" &&
      (!(state.activeEnforcements ?? []).some(
        (candidate) =>
          candidate.type === "RESTORATION" &&
          candidate.createdAt &&
          enforcement.createdAt &&
          candidate.createdAt > enforcement.createdAt,
      )) &&
      (!enforcement.expiresAt || enforcement.expiresAt > now),
  );
}

export function evaluateAccountAccess(
  state: AccountRestrictionState,
  now = new Date(),
): AccountAccessPolicy {
  const baseCode: Exclude<AccountAccessCode, null> | null =
    state.bannedAt || activeEnforcement(state, "PERMANENT_BAN", now)
    ? "banned"
    : state.deactivatedAt || activeEnforcement(state, "DEACTIVATION", now)
      ? "deactivated"
      : !state.isActive
        ? "inactive"
        : (state.suspendedAt &&
              (!state.suspendedUntil || state.suspendedUntil > now)) ||
            activeEnforcement(state, "TEMPORARY_SUSPENSION", now) ||
            activeEnforcement(state, "INDEFINITE_SUSPENSION", now)
          ? "suspended"
          : null;
  const baseAllowed = baseCode === null;
  const messagingRestricted =
    isTimedRestrictionActive(state.messagingRestrictedUntil, now) ||
    activeEnforcement(state, "MESSAGING_RESTRICTION", now);
  const connectionRestricted =
    isTimedRestrictionActive(state.connectionRequestsRestrictedUntil, now) ||
    activeEnforcement(state, "CONNECTION_REQUEST_RESTRICTION", now);
  const publishingRestricted =
    isTimedRestrictionActive(state.publishingRestrictedUntil, now) ||
    activeEnforcement(state, "PUBLISHING_RESTRICTION", now);
  const verificationRequired = activeEnforcement(
    state,
    "VERIFICATION_REQUIRED",
    now,
  );
  const expiresAt = [
    state.messagingRestrictedUntil,
    state.connectionRequestsRestrictedUntil,
    state.publishingRestrictedUntil,
    state.suspendedUntil,
    ...(state.activeEnforcements ?? []).map((entry) => entry.expiresAt),
  ]
    .filter((value): value is Date => Boolean(value && value > now))
    .sort((left, right) => left.getTime() - right.getTime())[0] ?? null;

  return {
    canAccessApplication: baseAllowed,
    canAdminister: baseAllowed,
    canAuthenticate: baseAllowed,
    canBlock: baseAllowed,
    canConnect: baseAllowed && !connectionRestricted,
    canCreateDeal: baseAllowed && !verificationRequired,
    canEditProfile: baseAllowed,
    canPublish: baseAllowed && !publishingRestricted && !verificationRequired,
    canReadMessages: baseAllowed,
    canReport: baseAllowed,
    canSendMessages: baseAllowed && !messagingRestricted,
    expiresAt,
    publicExplanation: baseCode
      ? baseCode === "suspended"
        ? "This account is currently suspended."
        : baseCode === "deactivated"
          ? "This account has been deactivated."
          : "Access to this account is unavailable."
      : null,
    reasonCode: baseCode,
  };
}

export function getOperationDecision(
  policy: AccountAccessPolicy,
  operation: AccountAccessOperation,
) {
  const allowed =
    operation === "authenticate"
      ? policy.canAuthenticate
      : operation === "application"
        ? policy.canAccessApplication
        : operation === "admin"
          ? policy.canAdminister
          : operation === "message:read"
            ? policy.canReadMessages
            : operation === "message:send"
              ? policy.canSendMessages
              : operation === "connect"
                ? policy.canConnect
                : operation === "publish"
                  ? policy.canPublish
                  : operation === "deal"
                    ? policy.canCreateDeal
                    : operation === "profile"
                      ? policy.canEditProfile
                      : operation === "report"
                        ? policy.canReport
                        : policy.canBlock;

  if (allowed) return null;
  if (policy.reasonCode) {
    return policy.publicExplanation;
  }
  if (operation === "message:send") {
    return "Messaging is temporarily restricted for this account.";
  }
  if (operation === "connect") {
    return "Connection requests are temporarily restricted for this account.";
  }
  if (operation === "publish") {
    return "Publishing is temporarily restricted for this account.";
  }
  if (operation === "deal") {
    return "Deal activity is temporarily restricted for this account.";
  }
  return "This action is not available for this account.";
}

export async function getActiveEnforcementActions(userId: string, now = new Date()) {
  return getPrisma().enforcementAction.findMany({
    orderBy: { createdAt: "desc" },
    select: { createdAt: true, expiresAt: true, status: true, type: true },
    take: 64,
    where: {
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      status: "ACTIVE",
      targetUserId: userId,
    },
  });
}

export async function getAccountAccessPolicy(userId: string) {
  const state = await getAccountRestrictionState(userId);
  return state ? evaluateAccountAccess(state) : null;
}

export async function assertAccountAccess(
  userId: string,
  operation: AccountAccessOperation,
) {
  const policy = await getAccountAccessPolicy(userId);
  if (!policy) return "Access to this account is unavailable.";
  return getOperationDecision(policy, operation);
}

export async function getAccountRestrictionState(userId: string) {
  const [state, activeEnforcements] = await Promise.all([
    getPrisma().user.findUnique({
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
        verificationStatus: true,
      },
      where: { id: userId },
    }),
    getActiveEnforcementActions(userId),
  ]);
  return state ? { ...state, activeEnforcements } : null;
}

export async function assertCanRequestConnection(userId: string) {
  return assertAccountAccess(userId, "connect");
}

export async function assertCanMessage(userId: string) {
  return assertAccountAccess(userId, "message:send");
}

export async function assertCanPublish(userId: string) {
  return assertAccountAccess(userId, "publish");
}

export async function assertCanCreateDeal(userId: string) {
  return assertAccountAccess(userId, "deal");
}

export async function assertCanEditProfile(userId: string) {
  return assertAccountAccess(userId, "profile");
}
