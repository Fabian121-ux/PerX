import { BrandLogo } from "@/components/brand-logo";
import Link from "next/link";
import { SignUpForm } from "@/components/auth/sign-up-form";
import { PublicPageShell } from "@/components/standard-page";
import { Card } from "@/components/ui/card";
import type { AuthFormState } from "@/features/auth/actions";

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
  const initialState: AuthFormState | undefined = error
    ? { message: error, status: "error" }
    : undefined;

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

            <div className="mt-5 text-right text-sm text-[color:var(--px-text-muted)]">
              Already have an account?{" "}
              <Link
                className="font-semibold text-[color:var(--px-primary)] hover:text-[color:var(--px-primary-strong)]"
                href="/sign-in"
              >
                Sign in
              </Link>
            </div>

            <SignUpForm initialState={initialState} />
          </Card>
        </section>
      </main>
    </PublicPageShell>
  );
}
