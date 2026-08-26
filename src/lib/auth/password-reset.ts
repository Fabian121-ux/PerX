import crypto from "node:crypto";

import { getPrisma } from "@/lib/db/prisma";

/**
 * Password reset grants.
 *
 * Design mirrors `Session`: the raw token is returned to the caller exactly
 * once and only its SHA-256 hash is persisted, so reading the database cannot
 * produce a working reset link. Lookup is by hash, which is a constant-length
 * unique index probe rather than a comparison over attacker-supplied input.
 *
 * A reset is consumed inside a conditional `updateMany` so that two concurrent
 * redemptions of the same link cannot both succeed: the first update matches
 * `consumedAt: null` and wins, the second matches zero rows and is rejected.
 */
export const PASSWORD_RESET_TOKEN_TTL_MINUTES = 30;

/** Cap on live grants per user, so requests cannot mint unlimited artifacts. */
export const MAX_ACTIVE_RESET_TOKENS_PER_USER = 3;

export function hashResetToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export type IssuedPasswordReset = {
  expiresAt: Date;
  /** Raw token. Returned once, never stored, never logged. */
  token: string;
};

/**
 * Issue a reset grant for a user.
 *
 * Existing unconsumed grants are invalidated first so a freshly requested link
 * is the only one that works. That also bounds how many rows a repeated
 * requester can create.
 */
export async function issuePasswordResetToken({
  requestedByAdminId = null,
  userId,
}: {
  requestedByAdminId?: string | null;
  userId: string;
}): Promise<IssuedPasswordReset> {
  const prisma = getPrisma();
  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(
    Date.now() + PASSWORD_RESET_TOKEN_TTL_MINUTES * 60_000,
  );

  await prisma.passwordResetToken.updateMany({
    data: { consumedAt: new Date() },
    where: { consumedAt: null, userId },
  });
  await prisma.passwordResetToken.create({
    data: {
      expiresAt,
      requestedByAdminId,
      tokenHash: hashResetToken(token),
      userId,
    },
  });

  return { expiresAt, token };
}

/**
 * Whether a user has already requested more resets than the window allows.
 *
 * Deliberately cheap: a bounded count over an indexed column rather than new
 * rate-limiting infrastructure. Callers still return the same neutral response
 * either way, so this never reveals account existence.
 */
export async function hasExceededResetRequestLimit(userId: string) {
  const recent = await getPrisma().passwordResetToken.count({
    where: {
      createdAt: {
        gt: new Date(Date.now() - PASSWORD_RESET_TOKEN_TTL_MINUTES * 60_000),
      },
      userId,
    },
  });
  return recent >= MAX_ACTIVE_RESET_TOKENS_PER_USER;
}

export type ConsumedPasswordReset =
  | { reason: "invalid"; ok: false }
  | { ok: true; userId: string };

/**
 * Atomically consume a reset token.
 *
 * Expiry, prior consumption and existence all collapse to the same
 * `invalid` result: the reset screen must not tell an attacker which of those
 * conditions applied.
 */
export async function consumePasswordResetToken(
  token: string,
): Promise<ConsumedPasswordReset> {
  if (!token) return { ok: false, reason: "invalid" };

  const prisma = getPrisma();
  const tokenHash = hashResetToken(token);
  const grant = await prisma.passwordResetToken.findUnique({
    select: { id: true, userId: true },
    where: { tokenHash },
  });
  if (!grant) return { ok: false, reason: "invalid" };

  const claimed = await prisma.passwordResetToken.updateMany({
    data: { consumedAt: new Date() },
    where: {
      consumedAt: null,
      expiresAt: { gt: new Date() },
      id: grant.id,
    },
  });
  if (!claimed.count) return { ok: false, reason: "invalid" };

  return { ok: true, userId: grant.userId };
}

/**
 * Check a token without consuming it, so the reset screen can render an
 * expired/used state instead of asking for a password it will reject.
 */
export async function isPasswordResetTokenRedeemable(token: string) {
  if (!token) return false;
  const grant = await getPrisma().passwordResetToken.findFirst({
    select: { id: true },
    where: {
      consumedAt: null,
      expiresAt: { gt: new Date() },
      tokenHash: hashResetToken(token),
    },
  });
  return Boolean(grant);
}
