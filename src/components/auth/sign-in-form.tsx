"use client";

import { Loader2 } from "lucide-react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { signInAction, type AuthFormState } from "@/features/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import { PasswordInput } from "@/components/ui/password-input";

type SignInFormProps = {
  initialState?: AuthFormState;
  nextPath: string;
};

export function SignInForm({ initialState, nextPath }: SignInFormProps) {
  const defaultState: AuthFormState = initialState ?? { status: "idle" };
  const [state, formAction] = useActionState(
    signInAction,
    defaultState,
  );
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

      <input name="next" type="hidden" value={nextPath} />

      <label className="grid gap-2 text-sm font-medium text-[color:var(--px-text)]">
        <span>Email address</span>
        <Input
          autoCapitalize="none"
          autoComplete="email"
          defaultValue={state.values?.email}
          inputMode="email"
          name="email"
          required
          type="email"
        />
      </label>

      <div className="grid gap-2 text-sm font-medium text-[color:var(--px-text)]">
        <label htmlFor="sign-in-password">Password</label>
        <PasswordInput
          autoComplete="current-password"
          id="sign-in-password"
          name="password"
          required
        />
      </div>

      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button disabled={pending} type="submit">
      {pending ? (
        <>
          <Loader2 aria-hidden className="mr-2 animate-spin" size={16} />
          Signing in
        </>
      ) : (
        "Sign in"
      )}
    </Button>
  );
}
