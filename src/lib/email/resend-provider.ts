import type {
  EmailDeliveryResult,
  EmailFailureReason,
  EmailMessage,
  EmailProvider,
} from "@/lib/email/provider";

const RESEND_ENDPOINT = "https://api.resend.com/emails";

/**
 * Map an HTTP status to a coarse, non-identifying reason.
 *
 * The provider's own message is discarded here on purpose: Resend echoes the
 * `from` address and parts of the request in its error bodies, and this value
 * ends up in an operational log.
 */
function reasonForStatus(status: number): EmailFailureReason {
  if (status === 401 || status === 403) return "unauthorized";
  if (status === 422 || status === 400) return "rejected";
  if (status === 429) return "rate_limited";
  return "unknown";
}

/**
 * Resend over its HTTP API.
 *
 * Raw `fetch` rather than the SDK: this is one POST, and adding a dependency
 * to an auth path means another package with network access and another supply
 * chain to trust. The provider is constructed with its configuration, so the
 * key lives in one object rather than being re-read from `process.env` deeper
 * in the call stack.
 *
 * This class is dormant until `service.ts` selects it, which happens only when
 * both RESEND_API_KEY and EMAIL_FROM are present.
 */
export class ResendEmailProvider implements EmailProvider {
  readonly id = "resend" as const;

  private readonly apiKey: string;
  private readonly from: string;

  constructor(config: { apiKey: string; from: string }) {
    this.apiKey = config.apiKey;
    this.from = config.from;
  }

  async send(message: EmailMessage): Promise<EmailDeliveryResult> {
    try {
      const response = await fetch(RESEND_ENDPOINT, {
        body: JSON.stringify({
          from: this.from,
          html: message.html,
          subject: message.subject,
          text: message.text,
          to: [message.to],
        }),
        headers: {
          // Never logged. The only place this value is allowed to appear.
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": message.idempotencyKey,
        },
        method: "POST",
      });

      if (!response.ok) {
        return {
          provider: "resend",
          reason: reasonForStatus(response.status),
          status: "failed",
        };
      }

      return { provider: "resend", status: "delivered" };
    } catch {
      /*
       * Swallowed deliberately, and the error object is not inspected: a fetch
       * failure can carry the request URL, headers and the Authorization value
       * in some runtimes. The caller needs to know only that the network leg
       * failed.
       */
      return { provider: "resend", reason: "network", status: "failed" };
    }
  }
}
