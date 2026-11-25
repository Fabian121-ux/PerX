import Link from "next/link";
import { redirect } from "next/navigation";

import { SignInForm } from "@/components/auth/sign-in-form";
import { PublicPageShell } from "@/components/standard-page";
import { Card } from "@/components/ui/card";
import { FormNotice } from "@/components/ui/form-notice";
import { getSafeAuthRedirect } from "@/lib/auth/redirects";
import { getCurrentUser } from "@/lib/auth/session";
import type { AuthFormState } from "@/features/auth/actions";

const errors: Record<string, string> = {
  "database-not-configured": "Sign-in is temporarily unavailable.",
  "invalid-credentials": "The email or password is incorrect.",
  "account-deactivated": "This account is deactivated.",
  unavailable: "Sign-in is temporarily unavailable. Try again.",
  "server-error": "Something went wrong. Try again.",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    next?: string;
    passwordReset?: string;
    verified?: string;
    returnTo?: string;
    signedOut?: string;
  }>;
}) {
  const params = await searchParams;
  const error = params.error ? errors[params.error] || "Sign-in failed." : null;
  const nextPath = getSafeAuthRedirect(params.next || params.returnTo);
  const currentUser = await getCurrentUser().catch(() => null);
  if (currentUser) redirect(nextPath);

  const initialState: AuthFormState | undefined = error
    ? { message: error, status: "error" }
    : undefined;

  return (
    <PublicPageShell>
      <main className="mx-auto grid min-h-[calc(100dvh-4.5rem)] max-w-md place-items-center px-4 py-8 sm:px-6">
        <Card className="w-full">
          <h1 className="text-2xl font-bold text-[color:var(--px-text)]">Sign in to PtahX</h1>
          <p className="mt-2 text-sm text-[color:var(--px-text-muted)]">
            Enter your email and password.
          </p>

          {params.verified === "1" && !error && (
            <FormNotice className="mt-4" tone="success">Email verified. You can sign in.</FormNotice>
          )}
          {params.passwordReset === "1" && !error && (
            <FormNotice className="mt-4" tone="success">Password updated. Sign in again.</FormNotice>
          )}
          {params.signedOut === "1" && !error && params.passwordReset !== "1" && (
            <FormNotice className="mt-4" tone="success">Signed out.</FormNotice>
          )}

          <SignInForm initialState={initialState} nextPath={nextPath} />
          <div className="mt-5 flex flex-wrap justify-between gap-3 text-sm">
            <Link className="font-semibold text-[color:var(--px-primary)]" href="/password-recovery">Forgot password?</Link>
            <Link className="font-semibold text-[color:var(--px-primary)]" href="/sign-up">Create account</Link>
          </div>
        </Card>
      </main>
    </PublicPageShell>
  );
}
