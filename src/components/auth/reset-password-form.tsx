"use client";

import { Loader2 } from "lucide-react";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import {
  resetPasswordAction,
  type PasswordResetFormState,
} from "@/features/auth/actions";
import { Button } from "@/components/ui/button";
import { FormNotice } from "@/components/ui/form-notice";
import { PasswordInput } from "@/components/ui/password-input";

const HINT_ID = "reset-password-hint";
const MISMATCH_ID = "reset-password-mismatch";

function SubmitButton({ disabled }: { disabled?: boolean }) {
  const { pending } = useFormStatus();

  return (
    <Button disabled={disabled || pending} type="submit">
      {pending ? (
        <>
          <Loader2 aria-hidden className="mr-2 animate-spin" size={16} />
          Updating password
        </>
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

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  /*
    Caught in the browser so a simple typo never costs a server round trip on a
    single-use link. The action re-checks this regardless - this is a
    convenience, not the security boundary.
  */
  const mismatch = confirmPassword.length > 0 && password !== confirmPassword;

  return (
    <form action={formAction} className="mt-6 grid gap-4">
      {state.status === "error" && state.message ? (
        <FormNotice tone="error">{state.message}</FormNotice>
      ) : null}

      {/* The token travels with the submission, never rendered as readable text. */}
      <input name="token" type="hidden" value={token} />

      <div className="grid gap-2 text-sm font-medium text-[color:var(--px-text)]">
        <label htmlFor="reset-password">New password</label>
        <PasswordInput
          aria-describedby={HINT_ID}
          autoComplete="new-password"
          id="reset-password"
          minLength={10}
          name="password"
          onChange={(event) => setPassword(event.target.value)}
          required
          value={password}
        />
        <span
          className="text-xs font-normal leading-5 text-[color:var(--px-text-muted)]"
          id={HINT_ID}
        >
          Use at least 10 characters, including a letter and a number.
        </span>
      </div>

      <div className="grid gap-2 text-sm font-medium text-[color:var(--px-text)]">
        <label htmlFor="reset-confirm-password">Confirm new password</label>
        <PasswordInput
          aria-describedby={mismatch ? MISMATCH_ID : undefined}
          aria-invalid={mismatch}
          autoComplete="new-password"
          id="reset-confirm-password"
          minLength={10}
          name="confirmPassword"
          onChange={(event) => setConfirmPassword(event.target.value)}
          required
          value={confirmPassword}
        />
        {mismatch ? (
          <span
            className="text-xs font-semibold leading-5 text-red-700 dark:text-red-300"
            id={MISMATCH_ID}
          >
            Both passwords must match.
          </span>
        ) : null}
      </div>

      <SubmitButton disabled={mismatch} />
    </form>
  );
}
