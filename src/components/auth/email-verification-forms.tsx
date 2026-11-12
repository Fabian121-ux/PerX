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

export function VerifyEmailForm({ token }: { token: string }) {
  const [state, formAction] = useActionState(verifyEmailAction, initialState);

  return (
    <form action={formAction} className="mt-5 grid gap-4">
      <input name="token" type="hidden" value={token} />
      {state.message ? (
        <p
          className="rounded-[var(--px-radius-sm)] bg-red-50 p-3 text-sm font-semibold text-red-700"
          role="alert"
        >
          {state.message}
        </p>
      ) : null}
      <SubmitButton label="Verify email address" pendingLabel="Verifying email" />
    </form>
  );
}

export function ResendEmailVerificationForm() {
  const [state, formAction] = useActionState(
    resendEmailVerificationAction,
    initialState,
  );

  return (
    <form action={formAction} className="mt-6 grid gap-3">
      <label
        className="grid gap-2 text-sm font-medium text-[color:var(--px-text)]"
        htmlFor="verification-email"
      >
        Email address
        <Input
          aria-describedby={state.fieldErrors?.email ? "verification-email-error" : undefined}
          aria-invalid={Boolean(state.fieldErrors?.email)}
          autoComplete="email"
          autoCapitalize="none"
          id="verification-email"
          inputMode="email"
          name="email"
          placeholder="you@example.com"
          required
          type="email"
        />
      </label>
      {state.fieldErrors?.email ? (
        <span
          className="text-xs font-semibold text-red-700"
          id="verification-email-error"
        >
          {state.fieldErrors.email}
        </span>
      ) : null}
      {state.message ? (
        <p
          className={
            state.status === "success"
              ? "rounded-[var(--px-radius-sm)] bg-emerald-50 p-3 text-sm font-semibold text-emerald-800"
              : "rounded-[var(--px-radius-sm)] bg-red-50 p-3 text-sm font-semibold text-red-700"
          }
          role={state.status === "success" ? "status" : "alert"}
        >
          {state.message}
        </p>
      ) : null}
      <SubmitButton
        label="Resend verification link"
        pendingLabel="Sending request"
      />
    </form>
  );
}

function SubmitButton({
  label,
  pendingLabel,
}: {
  label: string;
  pendingLabel: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button disabled={pending} type="submit">
      {pending ? pendingLabel : label}
    </Button>
  );
}
