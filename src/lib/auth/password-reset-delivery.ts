import crypto from "node:crypto";

import type { EmailDeliveryResult } from "@/lib/email/provider";
import {
  describeEmailConfiguration,
  getEmailProvider,
  isEmailDeliveryConfigured,
} from "@/lib/email/service";
import { buildPasswordResetEmail } from "@/lib/email/templates/password-reset";
import { getServerEnv } from "@/lib/env";

/**
 * Password reset link delivery.
 *
 * A thin caller over the generic email seam in `src/lib/email/`: it builds a
 * message and hands it to whichever provider is configured. All provider
 * selection, failure classification and credential handling lives there, so
 * no Resend-specific code appears in auth.
 *
 * The link is never logged in production, because anything written to a log
 * pipeline is a working credential until it expires.
 */

export type PasswordResetDeliveryOutcome = EmailDeliveryResult;

export type PasswordResetDelivery = {
  deliverPasswordResetLink(input: {
    email: string;
    expiresAt: Date;
    resetUrl: string;
  }): Promise<PasswordResetDeliveryOutcome>;
};

/**
 * An origin we are willing to put in an email.
 *
 * `getServerEnv()` defaults NEXT_PUBLIC_APP_URL to `http://localhost:3000`, so
 * an unset origin does NOT produce a relative link - it produces a confidently
 * wrong absolute one. Mailing that to a real inbox is worse than sending
 * nothing: the recipient gets a link that cannot work, and the one-use token is
 * spent. So a local origin disqualifies external delivery.
 */
function isExternallyUsableOrigin(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return false;
    return !["127.0.0.1", "::1", "localhost"].includes(url.hostname);
  } catch {
    return false;
  }
}

export const passwordResetDelivery: PasswordResetDelivery = {
  async deliverPasswordResetLink({ email, expiresAt, resetUrl }) {
    const provider = getEmailProvider();

    if (provider.id === "resend" && !isExternallyUsableOrigin(resetUrl)) {
      /*
       * Configuration failure, reported without the credential. Sending a
       * localhost link to a real recipient would burn the token on a URL that
       * cannot resolve.
       */
      console.error("[ptahx:password-reset-delivery]", {
        provider: provider.id,
        reason: "invalid_message",
        status: "failed",
        timestamp: new Date().toISOString(),
      });
      return {
        provider: "resend",
        reason: "invalid_message",
        status: "failed",
      };
    }

    const message = buildPasswordResetEmail({ expiresAt, resetUrl });
    return provider.send({
      ...message,
      /*
       * Derived from the token so a retry of the same grant de-duplicates at
       * the provider, but hashed and truncated so the key itself is not a
       * usable credential if it appears in provider-side metadata.
       */
      idempotencyKey: `password-reset-${crypto
        .createHash("sha256")
        .update(resetUrl)
        .digest("hex")
        .slice(0, 32)}`,
      to: email,
    });
  },
};

/**
 * Whether reset links can actually reach a user's inbox right now.
 *
 * Previously this returned `NODE_ENV !== "production"`, which answered a
 * different question - whether this is a development build - and was wrong in
 * both directions: development claimed an email was "on its way" when the link
 * had only reached a server console, and production claimed delivery was
 * disabled regardless of configuration.
 *
 *   real provider configured  -> true
 *   development console only  -> false
 *   disabled / unconfigured   -> false
 *   partial configuration     -> false
 */
export function isPasswordResetDeliveryConfigured() {
  return isEmailDeliveryConfigured();
}

/** Redacted configuration snapshot for operational logging. */
export function describePasswordResetDelivery() {
  return describeEmailConfiguration();
}

/**
 * Absolute reset URL.
 *
 * `getServerEnv()` supplies NEXT_PUBLIC_APP_URL - the canonical origin already
 * in the Zod schema - and defaults it to `http://localhost:3000`, so the result
 * is always absolute. Whether that origin is fit to mail is decided at delivery
 * time by `isExternallyUsableOrigin`.
 */
export function buildPasswordResetUrl(token: string) {
  const base = getServerEnv().NEXT_PUBLIC_APP_URL;
  return new URL(
    `/reset-password?token=${encodeURIComponent(token)}`,
    base,
  ).toString();
}
