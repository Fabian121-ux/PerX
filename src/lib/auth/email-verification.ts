import crypto from "node:crypto";
import { compare, hash } from "bcryptjs";

// Short-lived, one-time email codes. Keep resend and guess throttles separate.
export const EMAIL_VERIFICATION_CODE_TTL_MINUTES = 5;
export const EMAIL_VERIFICATION_CODE_LENGTH = 6;
export const MAX_EMAIL_VERIFICATION_REQUESTS_PER_WINDOW = 6;
export const EMAIL_VERIFICATION_RATE_WINDOW_MINUTES = 30;
export const MAX_EMAIL_VERIFICATION_ATTEMPTS_PER_WINDOW = 5;
export const EMAIL_VERIFICATION_ATTEMPT_WINDOW_MINUTES = 5;

export function createEmailVerificationCode() {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export function isEmailVerificationCode(value: string) {
  return /^\d{6}$/.test(value);
}

/** Store only a slow hash: a six-digit code must not be recoverable offline. */
export async function hashEmailVerificationCode(code: string) {
  return hash(code, 10);
}

export async function verifyEmailVerificationCode(code: string, digest: string) {
  if (!isEmailVerificationCode(code) || !digest.startsWith("$2")) return false;
  return compare(code, digest);
}

// Legacy link helpers retained solely for links already issued before the
// code rollout. No new verification URLs are generated.
export function hashEmailVerificationToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}
export function createEmailVerificationToken() {
  return crypto.randomBytes(32).toString("base64url");
}
