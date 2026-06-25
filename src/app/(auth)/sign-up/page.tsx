import { BrandLogo } from "@/components/brand-logo";
import { PublicPageShell } from "@/components/standard-page";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/form";
import { signUpAction } from "@/features/auth/actions";

const roleOptions = [
  ["FREELANCER", "Freelancer"],
  ["CLIENT", "Client"],
  ["FOUNDER", "Founder"],
  ["INVESTOR", "Investor"],
  ["PROPERTY_OWNER", "Property Owner"],
];

export default async function SignUpPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;

  return (
    <PublicPageShell>
      <main className="mx-auto grid min-h-[calc(100dvh-4.5rem)] max-w-6xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[.85fr_1.15fr] lg:px-8">
        <section className="perx-hero-card hidden rounded-[24px] p-8 shadow-[var(--px-shadow-strong)] lg:block">
          <BrandLogo className="h-12" dark />
          <div className="mt-10 max-w-sm">
            <p className="text-sm font-semibold uppercase tracking-wide text-blue-100">One account</p>
            <h2 className="mt-3 text-4xl font-black">Multiple ecosystem roles.</h2>
            <p className="mt-4 text-sm leading-7 text-blue-50">Freelancers, clients, founders and collaborators use one identity with capability-aware permissions.</p>
          </div>
        </section>
        <section className="grid place-items-center">
          <Card className="w-full max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-[color:var(--px-primary)]">Sign up</p>
          <h1 className="mt-2 text-3xl font-bold text-[color:var(--px-text)]">Create one account for your roles</h1>
          <p className="mt-3 text-sm leading-6 text-[color:var(--px-text-muted)]">Select every role you hold. perX uses capabilities behind the scenes, not separate accounts.</p>
          {params.error ? <p className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-700">Create account failed. Check the fields.</p> : null}
          <form action={signUpAction} className="mt-6 grid gap-4">
            <Field label="Name">
              <Input autoComplete="name" name="name" required />
            </Field>
            <Field label="Email">
              <Input autoComplete="email" name="email" required type="email" />
            </Field>
            <Field hint="Use at least 10 characters." label="Password">
              <Input autoComplete="new-password" minLength={10} name="password" required type="password" />
            </Field>
            <fieldset className="grid gap-3">
              <legend className="text-sm font-medium text-[color:var(--px-text)]">Roles</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {roleOptions.map(([value, label]) => (
                  <label className="flex items-center gap-3 rounded-[var(--px-radius-sm)] border border-[color:var(--px-border)] bg-white p-3 text-sm font-medium text-[color:var(--px-text-muted)] transition has-[:checked]:border-[color:var(--px-primary)] has-[:checked]:bg-blue-50" key={value}>
                    <input className="size-4 accent-[color:var(--px-primary)]" name="roles" type="checkbox" value={value} />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>
            <Button type="submit">Create account</Button>
          </form>
          </Card>
        </section>
      </main>
    </PublicPageShell>
  );
}
