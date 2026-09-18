import type {
  EmailDeliveryResult,
  EmailMessage,
  EmailProvider,
} from "@/lib/email/provider";

/**
 * Development-only seam: prints the message instead of sending it.
 *
 * This exists so a developer with no Resend account can still complete a
 * password reset locally. It returns `logged`, never `delivered`, because the
 * message reached a terminal and not an inbox - a distinction the recovery page
 * depends on to avoid promising an email nobody will receive.
 *
 * `service.ts` is what guarantees this is never selected in production.
 */
export class DevelopmentConsoleEmailProvider implements EmailProvider {
  readonly id = "development-console" as const;

  async send(message: EmailMessage): Promise<EmailDeliveryResult> {
    console.info(
      `[ptahx:email:development] to=${message.to} subject=${message.subject}\n${message.text}`,
    );
    return { provider: "development-console", status: "logged" };
  }
}
