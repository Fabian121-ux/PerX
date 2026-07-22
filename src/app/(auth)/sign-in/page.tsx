import Link from "next/link";
import { redirect } from "next/navigation";

import { SignInForm } from "@/components/auth/sign-in-form";
import { BrandLogo } from "@/components/brand-logo";
import { PublicPageShell } from "@/components/standard-page";
import { Card } from "@/components/ui/card";
import { getSafeAuthRedirect } from "@/lib/auth/redirects";
import { getCurrentUser } from "@/lib/auth/session";
import type { AuthFormState } from "@/features/auth/actions";

const errors: Record<string, string> = {
  "database-not-configured": "Database configuration is missing.",
  "invalid-credentials": "The email or password you entered is incorrect.",
  "account-deactivated": "Your account has been deactivated.",
  "unavailable": "The authentication service is temporarily unavailable. Please try again.",
  "server-error": "An unexpected server error occurred. Please try again.",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string; signedOut?: string; returnTo?: string }>;
}) {
  const params = await searchParams;
  const error = params.error ? errors[params.error] || "An unexpected error occurred." : null;
  const nextPath = getSafeAuthRedirect(params.next || params.returnTo);
  const currentUser = await getCurrentUser().catch(() => null);
  if (currentUser) redirect(nextPath);

  const isSignedOut = params.signedOut === "1";

  const initialState: AuthFormState | undefined = error
    ? { message: error, status: "error" }
    : undefined;

  return (
    <PublicPageShell>
      <main className="mx-auto grid min-h-[calc(100dvh-4.5rem)] max-w-6xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[.9fr_1.1fr] lg:px-8">
        <section className="perx-hero-card hidden rounded-[24px] p-8 shadow-[var(--px-shadow-strong)] lg:grid">
          <div>
            <BrandLogo className="h-12" dark />
            <div className="mt-10 max-w-sm">
              <p className="text-sm font-semibold uppercase tracking-wide text-blue-100">Secure access</p>
              <h2 className="mt-3 text-4xl font-black">Deals start with verified access.</h2>
              <p className="mt-4 text-sm leading-7 text-blue-50">
                Sign in to manage opportunities, proposals, messages, milestones, simulated deal states and reputation from one connected workspace.
              </p>
            </div>
          </div>
          <div className="mt-auto grid gap-3">
            {["Discovery", "Proposal", "Deal", "Trust"].map((item) => (
              <div className="flex items-center justify-between rounded-[var(--px-radius-sm)] bg-white/10 px-4 py-3 ring-1 ring-white/10" key={item}>
                <span className="font-semibold">{item}</span>
                <span className="rounded-full bg-white/14 px-2 py-1 text-xs font-bold text-white">Ready</span>
              </div>
            ))}
          </div>
        </section>
        <section className="grid place-items-center">
          <Card className="w-full max-w-md">
          <p className="text-sm font-semibold uppercase tracking-wide text-[color:var(--px-primary)]">Sign in</p>
          <h1 className="mt-2 text-3xl font-bold text-[color:var(--px-text)]">Welcome back to perX</h1>
          
          {isSignedOut && !error && (
            <div className="mb-4 mt-4 rounded border border-green-200 bg-green-50 p-3 text-sm text-green-700">
              You have been signed out successfully.
            </div>
          )}

          <SignInForm initialState={initialState} nextPath={nextPath} />
          <div className="mt-5 flex items-center justify-between text-sm">
            <Link className="font-medium text-[color:var(--px-primary)] hover:text-[color:var(--px-primary-strong)]" href="/password-recovery">
              Recover password
            </Link>
            <Link className="font-medium text-[color:var(--px-primary)] hover:text-[color:var(--px-primary-strong)]" href="/sign-up">
              Create account
            </Link>
          </div>
          </Card>
        </section>
      </main>
    </PublicPageShell>
  );
}
