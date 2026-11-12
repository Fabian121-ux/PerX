import crypto from "node:crypto";

import type { EmailDeliveryResult } from "@/lib/email/provider";
import {
  getEmailProvider,
  isEmailDeliveryConfigured,
} from "@/lib/email/service";
import { buildEmailVerificationEmail } from "@/lib/email/templates/email-verification";
import { getServerEnv } from "@/lib/env";

export type EmailVerificationDeliveryOutcome = EmailDeliveryResult;

export function isEmailVerificationDeliveryConfigured() {
  return isEmailDeliveryConfigured();
}

export function buildEmailVerificationUrl(token: string) {
  const base = getServerEnv().NEXT_PUBLIC_APP_URL;
  const url = new URL("/verify-email", base);
  url.searchParams.set("token", token);
  return url.toString();
}

/** Provider adapter; raw verification tokens are never logged or persisted. */
export async function deliverEmailVerification({
  email,
  expiresAt,
  token,
}: {
  email: string;
  expiresAt: Date;
  token: string;
}): Promise<EmailVerificationDeliveryOutcome> {
  const verificationUrl = buildEmailVerificationUrl(token);
  const message = buildEmailVerificationEmail({ expiresAt, verificationUrl });
  const idempotencyKey = `email-verification-${crypto
    .createHash("sha256")
    .update(token)
    .digest("hex")
    .slice(0, 32)}`;

  return getEmailProvider().send({
    ...message,
    idempotencyKey,
    to: email,
  });
}
