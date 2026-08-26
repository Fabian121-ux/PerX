"use client";

import { Loader2 } from "lucide-react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import {
  resetPasswordAction,
  type PasswordResetFormState,
} from "@/features/auth/actions";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/form";
import { PasswordInput } from "@/components/ui/password-input";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button disabled={pending} type="submit">
      {pending ? (
        <span className="inline-flex items-center gap-2">
          <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
          Updating password…
        </span>
      ) : (
        "Update password"
      )}
    </Button>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction] = useActionState(resetPasswordAction, {
    status: "idle",
  } satisfies PasswordResetFormState);

  return (
    <form action={formAction} className="mt-6 grid gap-4">
      {state.status === "error" && state.message ? (
        <div
          className="rounded-[var(--px-radius-sm)] bg-red-50 p-3 text-sm font-semibold text-red-700"
          role="alert"
        >
          {state.message}
        </div>
      ) : null}
      {/* The token travels with the submission, never rendered as readable text. */}
      <input name="token" type="hidden" value={token} />
      <Field label="New password">
        <PasswordInput
          autoComplete="new-password"
          minLength={10}
          name="password"
          required
        />
      </Field>
      <Field label="Confirm new password">
        <PasswordInput
          autoComplete="new-password"
          minLength={10}
          name="confirmPassword"
          required
        />
      </Field>
      <p className="text-xs text-[color:var(--px-text-muted)]">
        Use at least 10 characters, including a letter and a number.
      </p>
      <SubmitButton />
    </form>
  );
}
