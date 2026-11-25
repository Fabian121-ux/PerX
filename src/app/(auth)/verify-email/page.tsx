import Link from "next/link";

import { ResendEmailVerificationForm, VerifyEmailForm } from "@/components/auth/email-verification-forms";
import { PublicPageShell } from "@/components/standard-page";
import { Card } from "@/components/ui/card";
import { FormNotice } from "@/components/ui/form-notice";
import { isEmailVerificationDeliveryConfigured } from "@/lib/auth/email-verification-delivery";

export const dynamic = "force-dynamic";

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; email?: string; token?: string }>;
}) {
  const params = await searchParams;
  const email = typeof params.email === "string" ? params.email : "";
  const legacyToken = typeof params.token === "string" ? params.token : undefined;
  // Development uses the console sender for local browser acceptance tests.
  const configured = isEmailVerificationDeliveryConfigured() || process.env.NODE_ENV !== "production";

  return (
    <PublicPageShell>
      <main className="mx-auto grid min-h-[calc(100dvh-4.5rem)] max-w-md place-items-center px-4 py-8 sm:px-6">
        <Card className="w-full">
          <h1 className="text-2xl font-bold text-[color:var(--px-text)]">
            Verify your email
          </h1>
          <p className="mt-2 text-sm leading-6 text-[color:var(--px-text-muted)]">
            {legacyToken
              ? "Complete verification to continue."
              : "Check your inbox. Copy the six-digit code and enter it below. It is valid for 5 minutes."}
          </p>

          {params.status === "sent" && (
            <FormNotice className="mt-4" tone="success">
              We sent a verification code to your email.
            </FormNotice>
          )}
          {params.status === "pending" && (
            <FormNotice className="mt-4" tone="warning">
              Enter your latest code, or request a new one below.
            </FormNotice>
          )}
          {!configured && (
            <FormNotice className="mt-4" tone="warning">
              Email delivery is temporarily unavailable.
            </FormNotice>
          )}

          <VerifyEmailForm email={email} token={legacyToken} />
          {!legacyToken && configured && (
            <details className="mt-5 border-t border-[color:var(--px-border)] pt-4">
              <summary className="min-h-11 cursor-pointer text-sm font-semibold text-[color:var(--px-primary-ink)]">
                Didn&apos;t receive a code?
              </summary>
              <ResendEmailVerificationForm email={email} />
            </details>
          )}

          <p className="mt-5 text-center text-sm text-[color:var(--px-text-muted)]">
            Already verified?{" "}
            <Link className="font-semibold text-[color:var(--px-primary)]" href="/sign-in">
              Sign in
            </Link>
          </p>
        </Card>
      </main>
    </PublicPageShell>
  );
}
