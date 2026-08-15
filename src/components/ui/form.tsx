import { type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes, forwardRef } from "react";

import { cn } from "@/lib/utils";

export function Field({ children, hint, label }: { children: ReactNode; hint?: string; label: string }) {
  return (
    <div className="grid gap-2 text-sm font-medium text-[color:var(--px-text)]">
      <label className="contents">
        <span>{label}</span>
        {children}
      </label>
      {hint ? <span className="text-xs font-normal leading-5 text-[color:var(--px-text-muted)]">{hint}</span> : null}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => {
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
  }
);
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
