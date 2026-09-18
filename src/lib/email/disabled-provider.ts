import type {
  EmailDeliveryResult,
  EmailProvider,
} from "@/lib/email/provider";

/**
 * The default provider: sends nothing.
 *
 * Mirrors `DisabledPaymentProvider`. The difference is the failure mode: an
 * unavailable payment provider throws, because a user who cannot pay must be
 * told. Email delivery must NOT throw - password recovery has to return the
 * same neutral response whether or not mail can be sent, so this reports
 * `unconfigured` and lets the caller decide what to say.
 */
export class DisabledEmailProvider implements EmailProvider {
  readonly id = "disabled" as const;

  async send(): Promise<EmailDeliveryResult> {
    return { provider: "disabled", status: "unconfigured" };
  }
}
