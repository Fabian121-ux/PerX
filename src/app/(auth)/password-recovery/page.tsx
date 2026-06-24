import { BrandLogo } from "@/components/brand-logo";
import { PublicPageShell } from "@/components/standard-page";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/form";
import { passwordRecoveryAction } from "@/features/auth/actions";

export default async function PasswordRecoveryPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const params = await searchParams;

  return (
    <PublicPageShell>
      <main className="mx-auto grid min-h-[calc(100dvh-4.5rem)] max-w-md place-items-center px-4 py-10">
        <Card className="w-full">
          <BrandLogo className="mb-6 h-11" />
          <p className="text-sm font-semibold uppercase tracking-wide text-[color:var(--px-primary)]">Recovery</p>
          <h1 className="mt-2 text-3xl font-bold text-[color:var(--px-text)]">Recover password</h1>
          {params.status === "requested" ? (
            <p className="mt-3 rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">
              If that email exists, a recovery workflow has been recorded.
            </p>
          ) : null}
          <form action={passwordRecoveryAction} className="mt-6 grid gap-4">
            <Field label="Email">
              <Input autoComplete="email" name="email" required type="email" />
            </Field>
            <Button type="submit">Request recovery</Button>
          </form>
        </Card>
      </main>
    </PublicPageShell>
  );
}
