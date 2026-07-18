import { BrandLogo } from "@/components/brand-logo";
import Link from "next/link";
import { PublicPageShell } from "@/components/standard-page";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/form";
import { signUpAction } from "@/features/auth/actions";

const errors: Record<string, string> = {
  "database-not-configured": "Database configuration is missing.",
  "check-fields": "Please check your details and try again.",
  "email-taken": "An account with this email already exists.",
  "username-taken": "This username is already taken. Please try again.",
  "server-error": "An unexpected server error occurred. Please try again.",
};

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const error = params.error
    ? errors[params.error] || "An unexpected error occurred."
    : null;

  return (
    <PublicPageShell>
      <main className="mx-auto grid min-h-[calc(100dvh-4.5rem)] max-w-6xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[.85fr_1.15fr] lg:px-8">
        <section className="perx-hero-card hidden rounded-[24px] p-8 shadow-[var(--px-shadow-strong)] lg:block">
          <BrandLogo className="h-12" dark />
          <div className="mt-10 max-w-sm">
            <p className="text-sm font-semibold uppercase tracking-wide text-blue-100">
              Start simple
            </p>
            <h2 className="mt-3 text-4xl font-black">
              One profile for work, trust and agreements.
            </h2>
            <p className="mt-4 text-sm leading-7 text-blue-50">
              Create a professional identity first. Activity choices come after
              setup and do not permanently define who you are on perX.
            </p>
          </div>
        </section>
        <section className="grid place-items-center">
          <Card className="w-full max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-wide text-[color:var(--px-primary)]">
              Sign up
            </p>
            <h1 className="mt-2 text-3xl font-bold text-[color:var(--px-text)]">
              Create your PerX account
            </h1>
            <p className="mt-3 text-sm leading-6 text-[color:var(--px-text-muted)]">
              Start with your name, email and password. You can decide whether
              to find work, hire, post, partner or explore after your basic
              profile is ready.
            </p>

            <form action={signUpAction} className="mt-6 grid gap-4">
              {error && (
                <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <div className="text-sm text-right text-slate-500">
                Already have an account?{" "}
                <Link
                  href="/sign-in"
                  className="text-emerald-600 hover:underline"
                >
                  Sign in
                </Link>
              </div>

              <Field label="Full name">
                <Input autoComplete="name" name="name" required />
              </Field>
              <Field label="Email">
                <Input
                  autoComplete="email"
                  name="email"
                  required
                  type="email"
                />
              </Field>
              <Field hint="Use at least 10 characters." label="Password">
                <Input
                  autoComplete="new-password"
                  minLength={10}
                  name="password"
                  required
                  type="password"
                />
              </Field>
              <Button type="submit">Create account</Button>
            </form>
          </Card>
        </section>
      </main>
    </PublicPageShell>
  );
}
