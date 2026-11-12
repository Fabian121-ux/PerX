import crypto from "node:crypto";

export const EMAIL_VERIFICATION_TOKEN_TTL_HOURS = 24;
export const MAX_EMAIL_VERIFICATION_REQUESTS_PER_WINDOW = 3;
export const EMAIL_VERIFICATION_RATE_WINDOW_MINUTES = 30;

/** Persist only this digest; never store the bearer token itself. */
export function hashEmailVerificationToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/** High-entropy, URL-safe, single-use token. */
export function createEmailVerificationToken() {
  return crypto.randomBytes(32).toString("base64url");
}
