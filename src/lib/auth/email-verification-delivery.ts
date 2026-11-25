import crypto from "node:crypto";

import type { EmailDeliveryResult } from "@/lib/email/provider";
import { getEmailProvider, isEmailDeliveryConfigured } from "@/lib/email/service";
import { buildEmailVerificationEmail } from "@/lib/email/templates/email-verification";

export type EmailVerificationDeliveryOutcome = EmailDeliveryResult;

export function isEmailVerificationDeliveryConfigured() {
  return isEmailDeliveryConfigured();
}

/** Codes are emailed, never embedded in an access URL or logged. */
export async function deliverEmailVerification({
  email,
  expiresAt,
  code,
}: {
  email: string;
  expiresAt: Date;
  code: string;
}): Promise<EmailVerificationDeliveryOutcome> {
  const message = buildEmailVerificationEmail({ expiresAt, code });
  // Idempotency applies to this single generated code, not the email address.
  const idempotencyKey = `email-code-${crypto.createHash("sha256").update(email).update(":").update(code).digest("hex").slice(0, 32)}`;
  return getEmailProvider().send({ ...message, idempotencyKey, to: email });
}
