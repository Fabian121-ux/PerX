import Link from "next/link";

import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { BrandLogo } from "@/components/brand-logo";
import { PublicPageShell } from "@/components/standard-page";
import { Card } from "@/components/ui/card";
import { isPasswordResetTokenRedeemable } from "@/lib/auth/password-reset";
import { hasDatabaseUrl } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  const token = params.token ?? "";
  // Checked without consuming, so an expired link renders a recovery pathway
  // instead of asking for a password that would be rejected on submit.
  const redeemable =
    Boolean(token) && hasDatabaseUrl()
      ? await isPasswordResetTokenRedeemable(token)
      : false;

  return (
    <PublicPageShell>
      <main className="mx-auto grid min-h-[calc(100dvh-4.5rem)] max-w-md place-items-center px-4 py-10">
        <Card className="w-full">
          <BrandLogo className="mb-6 h-11" />
          <p className="text-sm font-semibold uppercase tracking-wide text-[color:var(--px-primary)]">
            Recovery
          </p>
          <h1 className="mt-2 text-3xl font-bold text-[color:var(--px-text)]">
            Choose a new password
          </h1>

          {redeemable ? (
            <>
              <p className="mt-3 text-sm text-[color:var(--px-text-muted)]">
                Set a new password for your account. Signing in again on your
                other devices will be required.
              </p>
              <ResetPasswordForm token={token} />
            </>
          ) : (
            <div className="mt-4 grid gap-4">
              <p
                className="rounded-[var(--px-radius-sm)] bg-amber-50 p-3 text-sm font-semibold text-amber-800"
                role="alert"
              >
                This reset link is invalid or has expired.
              </p>
              <p className="text-sm text-[color:var(--px-text-muted)]">
                Reset links can only be used once and expire shortly after they
                are sent. Request a new one to continue.
              </p>
              <Link
                className="font-medium text-[color:var(--px-primary)] hover:text-[color:var(--px-primary-strong)]"
                href="/password-recovery"
              >
                Request a new reset link
              </Link>
            </div>
          )}
        </Card>
      </main>
    </PublicPageShell>
  );
}
