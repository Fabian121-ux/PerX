"use client";

import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { signInAction, type AuthFormState } from "@/features/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form";

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
  const [showPassword, setShowPassword] = useState(false);

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
        <span className="relative block">
          <Input
            autoComplete="current-password"
            className="w-full pr-12"
            id="sign-in-password"
            name="password"
            required
            type={showPassword ? "text" : "password"}
          />
          <button
            aria-label={showPassword ? "Hide password" : "Show password"}
            className="absolute right-1.5 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-[var(--px-radius-sm)] text-[color:var(--px-text-muted)] transition hover:bg-[color:var(--px-muted)] hover:text-[color:var(--px-text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)]"
            onClick={() => setShowPassword((value) => !value)}
            type="button"
          >
            {showPassword ? (
              <EyeOff aria-hidden size={17} />
            ) : (
              <Eye aria-hidden size={17} />
            )}
          </button>
        </span>
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
