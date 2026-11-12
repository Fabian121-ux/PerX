import { DevelopmentConsoleEmailProvider } from "@/lib/email/development-console-provider";
import { DisabledEmailProvider } from "@/lib/email/disabled-provider";
import type { EmailProvider } from "@/lib/email/provider";
import { ResendEmailProvider } from "@/lib/email/resend-provider";

/**
 * Canonical PtahX transactional sender.
 * The verified Resend domain is ptahx.com; keep the visible sender identity
 * consistent across verification, password reset, and future transactional mail.
 */
export const PTAHX_EMAIL_FROM = "PtahX <hello@ptahx.com>";

const disabledProvider = new DisabledEmailProvider();
const developmentConsoleProvider = new DevelopmentConsoleEmailProvider();

function optionalApiKey() {
  const value = process.env.RESEND_API_KEY?.trim();
  return value ? value : undefined;
}

export type EmailConfiguration = {
  apiKey: string;
  from: string;
};

/** Resend is enabled when its API key is present; sender identity is canonical. */
export function getEmailConfiguration(): EmailConfiguration | null {
  const apiKey = optionalApiKey();
  if (!apiKey) return null;
  return { apiKey, from: PTAHX_EMAIL_FROM };
}

export function isEmailDeliveryConfigured() {
  return getEmailConfiguration() !== null;
}

export function getEmailProvider(): EmailProvider {
  const configuration = getEmailConfiguration();
  if (configuration) return new ResendEmailProvider(configuration);
  if (process.env.NODE_ENV !== "production") return developmentConsoleProvider;
  return disabledProvider;
}

/** Redacted configuration snapshot; never expose credentials or addresses. */
export function describeEmailConfiguration() {
  return {
    configured: isEmailDeliveryConfigured(),
    hasApiKey: optionalApiKey() !== undefined,
    hasFromAddress: true,
    provider: getEmailProvider().id,
  };
}
