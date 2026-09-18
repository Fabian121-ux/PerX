/**
 * Transactional email provider seam.
 *
 * Shaped after `src/lib/payments/`: a typed interface here, a default that
 * refuses in `disabled-provider.ts`, and one factory in `service.ts`. Nothing
 * leaves the building unless runtime configuration explicitly enables a real
 * provider.
 *
 * The interface is deliberately GENERIC transactional email - recipient,
 * subject, both bodies, idempotency key - and not password-reset-shaped.
 * Password recovery is the only consumer today; support replies, notification
 * digests and referrals are the next three and must not require changing this
 * contract.
 */

/** A message to send. The provider never persists or echoes these values. */
export type EmailMessage = {
  /** HTML body. Never logged, never returned in a result. */
  html: string;
  /**
   * Stable key for this logical send, so a retried delivery is not duplicated
   * by the provider. Must not embed a credential.
   */
  idempotencyKey: string;
  subject: string;
  /** Plain-text body. Never logged, never returned in a result. */
  text: string;
  /** Recipient address. Never logged, never returned in a result. */
  to: string;
};

/**
 * Coarse, non-identifying failure categories.
 *
 * Deliberately a closed set: a raw provider message can carry the from-address,
 * a request echo, or key fragments, none of which may reach a log.
 */
export type EmailFailureReason =
  | "invalid_message"
  | "network"
  | "rate_limited"
  | "rejected"
  | "unauthorized"
  | "unknown";

/**
 * What actually happened.
 *
 * A discriminated union rather than a boolean, because "false" cannot
 * distinguish "no provider is configured" from "the provider rejected this" -
 * and the caller has to tell a user which world they are in.
 *
 * Nothing here carries the recipient, the bodies, the reset URL, the API key,
 * the provider payload, or a raw provider error. A caller can log the whole
 * result safely; that is the point.
 */
export type EmailDeliveryResult =
  | { provider: "development-console"; status: "logged" }
  | { provider: "disabled"; status: "unconfigured" }
  | { provider: EmailProviderId; reason: EmailFailureReason; status: "failed" }
  | { provider: "resend"; status: "delivered" };

export type EmailProviderId = "development-console" | "disabled" | "resend";

export interface EmailProvider {
  readonly id: EmailProviderId;
  /**
   * Attempt delivery.
   *
   * MUST resolve to a result and MUST NOT throw: a provider outage has to be
   * indistinguishable from success to the requester of a password reset, and an
   * exception escaping here would become an enumeration oracle.
   */
  send(message: EmailMessage): Promise<EmailDeliveryResult>;
}
