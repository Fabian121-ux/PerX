import Link from "next/link";

import {
  ResendEmailVerificationForm,
  VerifyEmailForm,
} from "@/components/auth/email-verification-forms";
import { PublicPageShell } from "@/components/standard-page";
import { Card } from "@/components/ui/card";
import { FormNotice } from "@/components/ui/form-notice";
import { isEmailVerificationDeliveryConfigured } from "@/lib/auth/email-verification-delivery";

export const dynamic = "force-dynamic";

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; token?: string }>;
}) {
  const params = await searchParams;
  const token = params.token ?? "";
  const justCreated = params.status === "sent";
  const deliveryConfigured = isEmailVerificationDeliveryConfigured();

  return (
    <PublicPageShell>
      <main className="mx-auto grid min-h-[calc(100dvh-4.5rem)] max-w-md place-items-center px-4 py-10 sm:px-6 lg:px-8">
        <Card className="w-full">
          <p className="text-sm font-semibold uppercase tracking-wide text-[color:var(--px-primary)]">
            Email verification
          </p>
          <h1 className="mt-2 text-3xl font-bold text-[color:var(--px-text)]">
            {token ? "Confirm your email" : "Check your inbox"}
          </h1>

          {justCreated ? (
            <FormNotice className="mt-4" tone="success">
              Your account has been created. Open the verification link we sent
              to your email address to activate it. Check your spam or junk
              folder too. The link expires in 24 hours.
            </FormNotice>
          ) : null}

          {!deliveryConfigured ? (
            <FormNotice className="mt-4" tone="warning">
              Email delivery is not configured on this environment yet.
              Verification emails cannot be sent until the sending service is
              connected.
            </FormNotice>
          ) : null}

          {token ? (
            <>
              <p className="mt-3 text-sm leading-6 text-[color:var(--px-text-muted)]">
                Select the button below to verify this email address and
                activate your PtahX account.
              </p>
              <VerifyEmailForm token={token} />
            </>
          ) : (
            <>
              <p className="mt-3 text-sm leading-6 text-[color:var(--px-text-muted)]">
                Enter the email address you used to register. We will send a
                fresh link when the account is eligible for verification.
              </p>
              {deliveryConfigured ? <ResendEmailVerificationForm /> : null}
            </>
          )}

          <p className="mt-5 text-sm text-[color:var(--px-text-muted)]">
            Already verified?{" "}
            <Link
              className="font-semibold text-[color:var(--px-primary)] hover:text-[color:var(--px-primary-strong)]"
              href="/sign-in"
            >
              Sign in
            </Link>
          </p>
        </Card>
      </main>
    </PublicPageShell>
  );
}
