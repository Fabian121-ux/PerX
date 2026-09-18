import { DevelopmentConsoleEmailProvider } from "@/lib/email/development-console-provider";
import { DisabledEmailProvider } from "@/lib/email/disabled-provider";
import type { EmailProvider } from "@/lib/email/provider";
import { ResendEmailProvider } from "@/lib/email/resend-provider";

/**
 * Provider selection. Mirrors `getPaymentProvider()`.
 *
 * Read directly from `process.env` rather than through `getServerEnv()`: that
 * helper throws on unrelated misconfiguration (signup mode, strict deployment
 * checks), and email must never be able to fail a boot. A missing key is not an
 * error condition here - it is the default.
 */

const disabledProvider = new DisabledEmailProvider();
const developmentConsoleProvider = new DevelopmentConsoleEmailProvider();

/** Trimmed value, or undefined for absent/blank. Whitespace is not config. */
function optionalEnv(name: "EMAIL_FROM" | "RESEND_API_KEY") {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

export type EmailConfiguration = {
  apiKey: string;
  from: string;
};

/**
 * The complete Resend configuration, or null.
 *
 * Partial configuration deliberately returns null rather than throwing: a
 * half-configured deployment must degrade to "no email" rather than take the
 * application down.
 */
export function getEmailConfiguration(): EmailConfiguration | null {
  const apiKey = optionalEnv("RESEND_API_KEY");
  const from = optionalEnv("EMAIL_FROM");
  if (!apiKey || !from) return null;
  return { apiKey, from };
}

/**
 * Whether a real provider can put a message in someone's inbox.
 *
 * Note what this is NOT: it is not `NODE_ENV`, and it is not "did something get
 * logged". The development console provider answers `false` here, because a
 * line in a terminal is not a delivered email.
 */
export function isEmailDeliveryConfigured() {
  return getEmailConfiguration() !== null;
}

/**
 * The active provider.
 *
 * Precedence: a fully configured real provider, else the development console
 * seam outside production, else disabled. Disabled is the default in every
 * ambiguous case.
 */
export function getEmailProvider(): EmailProvider {
  const configuration = getEmailConfiguration();
  if (configuration) return new ResendEmailProvider(configuration);
  if (process.env.NODE_ENV !== "production") return developmentConsoleProvider;
  return disabledProvider;
}

/**
 * Redacted configuration snapshot for operational logging.
 *
 * Reports which values are PRESENT, never what they are.
 */
export function describeEmailConfiguration() {
  return {
    configured: isEmailDeliveryConfigured(),
    hasApiKey: optionalEnv("RESEND_API_KEY") !== undefined,
    hasFromAddress: optionalEnv("EMAIL_FROM") !== undefined,
    provider: getEmailProvider().id,
  };
}
