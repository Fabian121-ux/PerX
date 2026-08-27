import Link from "next/link";

import { PasswordRecoveryForm } from "@/components/auth/password-recovery-form";
import { isPasswordResetDeliveryConfigured } from "@/lib/auth/password-reset-delivery";
import { PublicPageShell } from "@/components/standard-page";
import { Card } from "@/components/ui/card";
import { FormNotice } from "@/components/ui/form-notice";

export default async function PasswordRecoveryPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const params = await searchParams;
  const requested = params.status === "requested";
  // Enumeration-safe either way: the wording never depends on whether the
  // address exists, only on whether this deployment can send mail at all.
  const canDeliver = isPasswordResetDeliveryConfigured();

  return (
    <PublicPageShell>
      <main className="mx-auto grid min-h-[calc(100dvh-4.5rem)] max-w-md place-items-center px-4 py-10 sm:px-6 lg:px-8">
        <Card className="w-full">
          <p className="text-sm font-semibold uppercase tracking-wide text-[color:var(--px-primary)]">
            Recovery
          </p>
          <h1 className="mt-2 text-3xl font-bold text-[color:var(--px-text)]">
            Recover password
          </h1>
          <p className="mt-3 text-sm leading-6 text-[color:var(--px-text-muted)]">
            Enter the email address for your account and we&apos;ll send you a
            link to choose a new password.
          </p>

          {requested ? (
            <FormNotice className="mt-4" tone={canDeliver ? "success" : "info"}>
              {canDeliver
                ? "If that email exists, a password reset link is on its way. The link expires in 30 minutes."
                : "Your request was recorded. Email delivery is not yet enabled on this environment, so contact support to finish resetting your password."}
            </FormNotice>
          ) : null}

          <PasswordRecoveryForm />

          <p className="mt-5 text-sm text-[color:var(--px-text-muted)]">
            Remembered it?{" "}
            <Link
              className="font-medium text-[color:var(--px-primary)] hover:text-[color:var(--px-primary-strong)]"
              href="/sign-in"
            >
              Back to sign in
            </Link>
          </p>
        </Card>
      </main>
    </PublicPageShell>
  );
}
