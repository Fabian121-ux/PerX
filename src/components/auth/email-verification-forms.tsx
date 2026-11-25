"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import {
  resendEmailVerificationAction,
  verifyEmailAction,
  type EmailVerificationFormState,
} from "@/features/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form";

const initialState: EmailVerificationFormState = { status: "idle" };

export function VerifyEmailForm({
  email = "",
  token,
}: {
  email?: string;
  token?: string;
}) {
  const [state, formAction] = useActionState(verifyEmailAction, initialState);
  return (
    <form action={formAction} className="mt-5 grid gap-4">
      {token ? (
        <input name="token" type="hidden" value={token} />
      ) : (
        <>
          <label className="grid gap-2 text-sm font-semibold text-[color:var(--px-text)]">
            Email address
            <Input
              autoCapitalize="none"
              autoComplete="email"
              defaultValue={email}
              name="email"
              required
              type="email"
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-[color:var(--px-text)]">
            Verification code
            <Input
              autoComplete="one-time-code"
              autoFocus={!token}
              className="w-full text-center text-xl font-bold tracking-[0.3em]"
              inputMode="numeric"
              maxLength={6}
              minLength={6}
              name="code"
              pattern="[0-9]{6}"
              placeholder="000000"
              required
              type="text"
            />
          </label>
        </>
      )}
      {state.message && (
        <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
          {state.message}
        </p>
      )}
      <SubmitButton label="Verify and continue" pendingLabel="Verifying…" />
    </form>
  );
}

export function ResendEmailVerificationForm({ email = "" }: { email?: string }) {
  const [state, formAction] = useActionState(resendEmailVerificationAction, initialState);
  return (
    <form action={formAction} className="mt-4 grid gap-3">
      <label className="grid gap-2 text-sm font-medium text-[color:var(--px-text)]">
        Email address
        <Input
          autoCapitalize="none"
          autoComplete="email"
          defaultValue={email}
          name="email"
          required
          type="email"
        />
      </label>
      {state.message && (
        <p
          className={state.status === "success" ? "text-sm text-[color:var(--px-text-muted)]" : "text-sm font-semibold text-red-700"}
          role={state.status === "success" ? "status" : "alert"}
        >
          {state.message}
        </p>
      )}
      <SubmitButton label="Send a new code" pendingLabel="Sending…" />
    </form>
  );
}

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button disabled={pending} type="submit">
      {pending ? pendingLabel : label}
    </Button>
  );
}
