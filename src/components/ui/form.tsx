import { type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes, forwardRef } from "react";

import { cn } from "@/lib/utils";

export function Field({ children, hint, label }: { children: ReactNode; hint?: string; label: string }) {
  return (
    <label className="grid gap-2 text-sm font-medium text-[color:var(--px-text)]">
      <span>{label}</span>
      {children}
      {hint ? <span className="text-xs font-normal leading-5 text-[color:var(--px-text-muted)]">{hint}</span> : null}
    </label>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  (props, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          "min-h-11 rounded-[var(--px-radius-sm)] border border-[color:var(--px-border)] bg-[color:var(--px-surface)] px-3 py-2 text-sm text-[color:var(--px-text)] shadow-sm outline-none transition placeholder:text-[color:var(--px-text-muted)] focus:border-[color:var(--px-focus)] focus:ring-2 focus:ring-[color:var(--px-focus)]/25",
          props.className,
        )}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "min-h-28 rounded-[var(--px-radius-sm)] border border-[color:var(--px-border)] bg-[color:var(--px-surface)] px-3 py-2 text-sm text-[color:var(--px-text)] shadow-sm outline-none transition placeholder:text-[color:var(--px-text-muted)] focus:border-[color:var(--px-focus)] focus:ring-2 focus:ring-[color:var(--px-focus)]/25",
        props.className,
      )}
      {...props}
    />
  );
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "min-h-11 rounded-[var(--px-radius-sm)] border border-[color:var(--px-border)] bg-[color:var(--px-surface)] px-3 py-2 text-sm text-[color:var(--px-text)] shadow-sm outline-none transition focus:border-[color:var(--px-focus)] focus:ring-2 focus:ring-[color:var(--px-focus)]/25",
        props.className,
      )}
      {...props}
    />
  );
}
