import "server-only";

import { getPrisma } from "@/lib/db/prisma";
import {
  getAdminActiveRestrictions,
  getAdminAccountState,
} from "@/lib/admin/operational-summaries";
import type { RoleName } from "@/lib/permissions/capabilities";

/**
 * Admin user detail.
 *
 * Split into an identity query and independent optional sections. Account
 * management has to keep working when a secondary panel fails, so the optional
 * loaders are never awaited together with the identity load and each is
 * individually recoverable.
 *
 * Every query uses an explicit `select`. The admin surface reads accounts it
 * has no relationship with, so a broad `include` here would pull `passwordHash`
 * into a React Server Component payload.
 */

/** Bounded so one prolific account cannot produce an unbounded response. */
export const ADMIN_USER_HISTORY_LIMIT = 10;

export type AdminUserDetail = NonNullable<
  Awaited<ReturnType<typeof getAdminUserDetail>>
>;

export async function getAdminUserDetail(userId: string) {
  const user = await getPrisma().user.findUnique({
    select: {
      accountClassification: true,
      bannedAt: true,
      connectionRequestsRestrictedUntil: true,
      createdAt: true,
      deactivatedAt: true,
      email: true,
      emailVerifiedAt: true,
      enforcementReasonPublic: true,
      id: true,
      isActive: true,
      messagingRestrictedUntil: true,
      name: true,
      publishingRestrictedUntil: true,
      roles: { select: { role: { select: { label: true, name: true } } } },
      suspendedAt: true,
      suspendedUntil: true,
      username: true,
      verificationStatus: true,
      // Never selected: passwordHash. Nothing in the admin surface may read,
      // display, or transmit it.
    },
    where: { id: userId },
  });

  if (!user) return null;

  const now = new Date();
  return {
    accountClassification: user.accountClassification,
    accountState: getAdminAccountState(user, now),
    activeRestrictions: getAdminActiveRestrictions(user, now),
    createdAt: user.createdAt,
    email: user.email,
    emailVerifiedAt: user.emailVerifiedAt,
    enforcementReasonPublic: user.enforcementReasonPublic,
    id: user.id,
    name: user.name,
    roles: user.roles.map((entry) => ({
      label: entry.role.label,
      name: entry.role.name as RoleName,
    })),
    suspendedUntil: user.suspendedUntil,
    username: user.username,
    verificationStatus: user.verificationStatus,
  };
}

/**
 * Active session count and most recent activity.
 *
 * Deliberately aggregate-only: an admin needs to know whether sessions exist in
 * order to decide about revoking them, not the token metadata behind them.
 */
export async function getAdminUserSessionSummary(userId: string) {
  const now = new Date();
  const [activeSessions, latest] = await Promise.all([
    getPrisma().session.count({
      where: { expiresAt: { gt: now }, userId },
    }),
    getPrisma().session.findFirst({
      orderBy: { lastSeenAt: "desc" },
      select: { lastSeenAt: true },
      where: { expiresAt: { gt: now }, userId },
    }),
  ]);

  return { activeSessions, lastSeenAt: latest?.lastSeenAt ?? null };
}

/**
 * Recent audit entries naming this user.
 *
 * `metadata` is intentionally excluded - it is an unbounded JSON column, and
 * the summary list only renders action, actor and timestamp.
 */
export async function getAdminUserAuditHistory(userId: string) {
  return getPrisma().auditLog.findMany({
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: {
      action: true,
      actor: { select: { id: true, name: true, username: true } },
      createdAt: true,
      entityType: true,
      id: true,
    },
    take: ADMIN_USER_HISTORY_LIMIT,
    where: { entityId: userId, entityType: "user" },
  });
}

/** Enforcement history for the account, most recent first. */
export async function getAdminUserEnforcementHistory(userId: string) {
  return getPrisma().enforcementAction.findMany({
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: {
      createdAt: true,
      expiresAt: true,
      id: true,
      status: true,
      type: true,
      userFacingExplanation: true,
      // `internalNote` and `reason` are omitted: the summary panel does not
      // render them, so they should not travel to the browser.
    },
    take: ADMIN_USER_HISTORY_LIMIT,
    where: { targetUserId: userId },
  });
}
