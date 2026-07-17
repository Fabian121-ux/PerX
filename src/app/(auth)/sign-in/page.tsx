import Link from "next/link";

import { BrandLogo } from "@/components/brand-logo";
import { PublicPageShell } from "@/components/standard-page";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/form";
import { signInAction } from "@/features/auth/actions";

const errors: Record<string, string> = {
  "database-not-configured": "Database configuration is missing.",
  "invalid-credentials": "The email or password you entered is incorrect.",
  "account-deactivated": "Your account has been deactivated.",
  "unavailable": "The authentication service is temporarily unavailable. Please try again.",
  "server-error": "An unexpected server error occurred. Please try again.",
};

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  const error = params.error ? errors[params.error] || "An unexpected error occurred." : null;

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
          {error && <div className="mt-3 rounded-[var(--px-radius-sm)] bg-red-50 p-3 text-sm text-red-700">{error}</div>}
          <form action={signInAction} className="mt-6 grid gap-4">
            <Field label="Email">
              <Input autoComplete="email" name="email" required type="email" />
            </Field>
            <Field label="Password">
              <Input autoComplete="current-password" name="password" required type="password" />
            </Field>
            <Button type="submit">Sign in</Button>
          </form>
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
