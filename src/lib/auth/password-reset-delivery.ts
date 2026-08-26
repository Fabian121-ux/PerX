import { getServerEnv } from "@/lib/env";

/**
 * Password reset link delivery.
 *
 * PreX has no email provider configured (audited: no resend/nodemailer/
 * sendgrid/postmark integration exists anywhere in the repository). Rather
 * than invent Production credentials or add a provider nobody asked for, this
 * is a narrow seam with one server-side implementation today.
 *
 * When an email provider is introduced, replace the body of
 * `deliverPasswordResetLink` and nothing else changes: callers already treat
 * delivery as fire-and-forget and always return the same neutral response.
 *
 * The link is never logged in production, because anything written to a log
 * pipeline is a working credential until it expires.
 */
export type PasswordResetDelivery = {
  deliverPasswordResetLink(input: {
    email: string;
    expiresAt: Date;
    resetUrl: string;
  }): Promise<void>;
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
      return;
    }

    // No production email provider is configured yet. Failing loudly here
    // would leak account existence through timing/error differences, so the
    // request stays neutral and the absence is surfaced operationally.
    console.warn(
      "[password-reset] no email provider configured; reset link was not delivered",
    );
  },
};

export function buildPasswordResetUrl(token: string) {
  const base = getServerEnv().NEXT_PUBLIC_APP_URL ?? "";
  const path = `/reset-password?token=${encodeURIComponent(token)}`;
  return base ? new URL(path, base).toString() : path;
}
