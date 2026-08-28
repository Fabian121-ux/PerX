import {
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
  forwardRef,
} from "react";

import { FieldError } from "@/components/ui/field-error";
import { cn } from "@/lib/utils";

/**
 * Labelled form control.
 *
 * `error` and `name` are optional so existing call sites are unaffected. When
 * both are supplied the hint and error get stable ids, which is what lets the
 * caller point `aria-describedby` at them - without ids the message is visible
 * but invisible to a screen reader on the control itself.
 */
export function Field({
  children,
  error,
  hint,
  label,
  name,
}: {
  children: ReactNode;
  error?: string;
  hint?: string;
  label: string;
  name?: string;
}) {
  const hintId = name ? `${name}-hint` : undefined;
  const errorId = name ? `${name}-error` : undefined;

  return (
    <div className="grid gap-2 text-sm font-medium text-[color:var(--px-text)]">
      <label className="contents">
        <span>{label}</span>
        {children}
      </label>
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

export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => {
  return (
    <input
      ref={ref}
      className={cn(
        "min-h-11 w-full min-w-0 rounded-[var(--px-radius-sm)] border border-[color:var(--px-border)] bg-[color:var(--px-surface)] px-3 py-2 text-sm text-[color:var(--px-text)] shadow-sm outline-none transition placeholder:text-[color:var(--px-text-muted)] focus:border-[color:var(--px-focus)] focus:ring-2 focus:ring-[color:var(--px-focus)]/25 disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-[color:var(--px-error)] aria-invalid:ring-2 aria-invalid:ring-red-500/20",
        className,
      )}
      {...props}
    />
  );
});
Input.displayName = "Input";

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { className, ...textareaProps } = props;
  return (
    <textarea
      className={cn(
        "min-h-28 w-full min-w-0 rounded-[var(--px-radius-sm)] border border-[color:var(--px-border)] bg-[color:var(--px-surface)] px-3 py-2 text-sm text-[color:var(--px-text)] shadow-sm outline-none transition placeholder:text-[color:var(--px-text-muted)] focus:border-[color:var(--px-focus)] focus:ring-2 focus:ring-[color:var(--px-focus)]/25 disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-[color:var(--px-error)] aria-invalid:ring-2 aria-invalid:ring-red-500/20",
        className,
      )}
      {...textareaProps}
    />
  );
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  const { className, ...selectProps } = props;
  return (
    <select
      className={cn(
        "min-h-11 w-full min-w-0 rounded-[var(--px-radius-sm)] border border-[color:var(--px-border)] bg-[color:var(--px-surface)] px-3 py-2 text-sm text-[color:var(--px-text)] shadow-sm outline-none transition focus:border-[color:var(--px-focus)] focus:ring-2 focus:ring-[color:var(--px-focus)]/25 disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-[color:var(--px-error)] aria-invalid:ring-2 aria-invalid:ring-red-500/20",
        className,
      )}
      {...selectProps}
    />
  );
}
