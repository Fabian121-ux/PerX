"use client";

import { Eye, EyeOff, Loader2 } from "lucide-react";
import type { InputHTMLAttributes } from "react";
import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";

import { signUpAction, type AuthFormState } from "@/features/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form";

type SignUpFormProps = {
  initialState?: AuthFormState;
};

export function SignUpForm({ initialState }: SignUpFormProps) {
  const defaultState: AuthFormState = initialState ?? { status: "idle" };
  const [state, formAction] = useActionState(
    signUpAction,
    defaultState,
  );
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const clientPasswordMismatch = Boolean(
    confirmPassword && password && confirmPassword !== password,
  );
  const confirmPasswordError = clientPasswordMismatch
    ? "Passwords do not match."
    : state.fieldErrors?.confirmPassword;

  const passwordHint = useMemo(
    () => "Use at least 10 characters with at least one letter and one number.",
    [],
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

      <TextField
        autoComplete="name"
        error={state.fieldErrors?.name}
        label="Full name"
        name="name"
        required
        value={state.values?.name}
      />
      <TextField
        autoCapitalize="none"
        autoComplete="username"
        error={state.fieldErrors?.username}
        hint="Use 3-30 letters, numbers, underscores or hyphens."
        inputMode="text"
        label="Username"
        name="username"
        pattern="[a-zA-Z0-9_-]+"
        required
        value={state.values?.username}
      />
      <TextField
        autoCapitalize="none"
        autoComplete="email"
        error={state.fieldErrors?.email}
        inputMode="email"
        label="Email address"
        name="email"
        required
        type="email"
        value={state.values?.email}
      />

      <PasswordField
        autoComplete="new-password"
        error={state.fieldErrors?.password}
        hint={passwordHint}
        label="Password"
        name="password"
        onChange={setPassword}
        show={showPassword}
        toggle={() => setShowPassword((value) => !value)}
        value={password}
      />
      <PasswordField
        autoComplete="new-password"
        error={confirmPasswordError}
        label="Confirm password"
        name="confirmPassword"
        onChange={setConfirmPassword}
        show={showConfirmPassword}
        toggle={() => setShowConfirmPassword((value) => !value)}
        value={confirmPassword}
      />

      <label className="flex items-start gap-3 rounded-[var(--px-radius-sm)] border border-[color:var(--px-border)] bg-[color:var(--px-surface-soft)] p-3 text-sm text-[color:var(--px-text-muted)]">
        <input
          aria-invalid={Boolean(state.fieldErrors?.terms)}
          className="mt-1 size-4 shrink-0 accent-[color:var(--px-primary)]"
          name="terms"
          required
          type="checkbox"
        />
        <span>
          I agree to the PerX{" "}
          <a
            className="font-semibold text-[color:var(--px-primary)] hover:text-[color:var(--px-primary-strong)]"
            href="/terms"
          >
            Terms
          </a>{" "}
          and{" "}
          <a
            className="font-semibold text-[color:var(--px-primary)] hover:text-[color:var(--px-primary-strong)]"
            href="/privacy"
          >
            Privacy Policy
          </a>
          .
          <FieldError message={state.fieldErrors?.terms} />
        </span>
      </label>

      <SubmitButton disabled={clientPasswordMismatch} />
    </form>
  );
}

function TextField({
  error,
  hint,
  label,
  name,
  value,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  error?: string;
  hint?: string;
  label: string;
  value?: string;
}) {
  const errorId = `${name}-error`;
  const hintId = `${name}-hint`;

  return (
    <label className="grid gap-2 text-sm font-medium text-[color:var(--px-text)]">
      <span>{label}</span>
      <Input
        aria-describedby={`${hint ? hintId : ""} ${error ? errorId : ""}`.trim() || undefined}
        aria-invalid={Boolean(error)}
        defaultValue={value}
        name={name}
        {...props}
      />
      {hint ? (
        <span
          className="text-xs font-normal leading-5 text-[color:var(--px-text-muted)]"
          id={hintId}
        >
          {hint}
        </span>
      ) : null}
      <FieldError id={errorId} message={error} />
    </label>
  );
}

function PasswordField({
  error,
  hint,
  label,
  name,
  onChange,
  show,
  toggle,
  value,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "type" | "value"> & {
  error?: string;
  hint?: string;
  label: string;
  onChange: (value: string) => void;
  show: boolean;
  toggle: () => void;
  value: string;
}) {
  const errorId = `${name}-error`;
  const hintId = `${name}-hint`;
  const inputId = `${name}-input`;

  return (
    <div className="grid gap-2 text-sm font-medium text-[color:var(--px-text)]">
      <label htmlFor={inputId}>{label}</label>
      <span className="relative block">
        <Input
          aria-describedby={`${hint ? hintId : ""} ${error ? errorId : ""}`.trim() || undefined}
          aria-invalid={Boolean(error)}
          className="w-full pr-12"
          id={inputId}
          minLength={10}
          name={name}
          onChange={(event) => onChange(event.currentTarget.value)}
          required
          type={show ? "text" : "password"}
          value={value}
          {...props}
        />
        <button
          aria-label={show ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          className="absolute right-1.5 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-[var(--px-radius-sm)] text-[color:var(--px-text-muted)] transition hover:bg-[color:var(--px-muted)] hover:text-[color:var(--px-text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)]"
          onClick={toggle}
          type="button"
        >
          {show ? <EyeOff aria-hidden size={17} /> : <Eye aria-hidden size={17} />}
        </button>
      </span>
      {hint ? (
        <span
          className="text-xs font-normal leading-5 text-[color:var(--px-text-muted)]"
          id={hintId}
        >
          {hint}
        </span>
      ) : null}
      <FieldError id={errorId} message={error} />
    </div>
  );
}

function FieldError({ id, message }: { id?: string; message?: string }) {
  if (!message) return null;
  return (
    <span className="text-xs font-semibold leading-5 text-red-700" id={id}>
      {message}
    </span>
  );
}

function SubmitButton({ disabled }: { disabled?: boolean }) {
  const { pending } = useFormStatus();

  return (
    <Button disabled={disabled || pending} type="submit">
      {pending ? (
        <>
          <Loader2 aria-hidden className="mr-2 animate-spin" size={16} />
          Creating account
        </>
      ) : (
        "Create account"
      )}
    </Button>
  );
}
