"use client";

import { Loader2 } from "lucide-react";
import { useFormStatus } from "react-dom";

import { passwordRecoveryAction } from "@/features/auth/actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";

/**
 * Client component purely so the submit button can observe `useFormStatus`.
 *
 * The recovery action is one of the slowest in the app - it parses, reads the
 * user, checks the request-rate limit, issues a token and dispatches delivery -
 * and it deliberately takes the same path whether or not the address exists, so
 * enumeration is not possible. Without a pending state that shows as a dead
 * button, and an impatient second click spends another attempt against the
 * per-user reset limit, which can lock the user out of their own recovery.
 */
function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button disabled={pending} type="submit">
      {pending ? (
        <>
          <Loader2 aria-hidden className="mr-2 animate-spin" size={16} />
          Sending reset link
        </>
      ) : (
        "Send reset link"
      )}
    </Button>
  );
}

export function PasswordRecoveryForm() {
  return (
    <form action={passwordRecoveryAction} className="mt-6 grid gap-4">
      <Field
        hint="We'll send a reset link to this address if it matches an account."
        label="Email"
      >
        <Input
          autoComplete="email"
          id="recovery-email"
          name="email"
          required
          type="email"
        />
      </Field>
      <SubmitButton />
    </form>
  );
}
