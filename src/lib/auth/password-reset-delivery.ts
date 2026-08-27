import { getServerEnv } from "@/lib/env";

/**
 * Password reset link delivery.
 *
 * PreX has no email provider configured (audited: no resend/nodemailer/
 * sendgrid/postmark integration exists anywhere in the repository). Rather
 * than invent Production credentials or add a provider nobody asked for, this
 * is a narrow seam with one server-side implementation today.
 *
 * To connect a real provider, implement `PasswordResetDelivery` and swap the
 * export below - no caller changes. Return `"delivered"` only when the provider
 * has actually accepted the message.
 *
 * The link is never logged in production, because anything written to a log
 * pipeline is a working credential until it expires.
 */

/**
 * What actually happened, so the UI can describe it truthfully.
 *
 * - `delivered`     a provider accepted the message
 * - `logged`        development seam; the link went to the server console
 * - `unconfigured`  no provider exists, so nothing was sent
 *
 * Returning a result rather than `void` is the point: without it every caller
 * has to assume success, and the interface ends up telling users an email is on
 * its way when nothing was sent.
 */
export type PasswordResetDeliveryOutcome =
  | "delivered"
  | "logged"
  | "unconfigured";

export type PasswordResetDelivery = {
  deliverPasswordResetLink(input: {
    email: string;
    expiresAt: Date;
    resetUrl: string;
  }): Promise<PasswordResetDeliveryOutcome>;
};

function isDevelopmentDelivery() {
  return process.env.NODE_ENV !== "production";
}

export const passwordResetDelivery: PasswordResetDelivery = {
  async deliverPasswordResetLink({ email, expiresAt, resetUrl }) {
    if (isDevelopmentDelivery()) {
      // Development/test only. Never reached in production builds.
      console.info(
        `[password-reset] link for ${email} (expires ${expiresAt.toISOString()}): ${resetUrl}`,
      );
      return "logged";
    }

    // No production email provider is configured yet. Failing loudly here
    // would leak account existence through timing/error differences, so the
    // request stays neutral and the absence is surfaced operationally.
    console.warn(
      "[password-reset] no email provider configured; reset link was not delivered",
    );
    return "unconfigured";
  },
};

/**
 * Whether reset links can actually reach a user right now.
 *
 * Read by the admin surface so an operator is told plainly that no provider is
 * connected, instead of being shown a success message for an email that was
 * never sent.
 */
export function isPasswordResetDeliveryConfigured() {
  return isDevelopmentDelivery();
}

export function buildPasswordResetUrl(token: string) {
  const base = getServerEnv().NEXT_PUBLIC_APP_URL ?? "";
  const path = `/reset-password?token=${encodeURIComponent(token)}`;
  return base ? new URL(path, base).toString() : path;
}
