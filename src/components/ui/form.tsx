import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export function Field({ children, hint, label }: { children: ReactNode; hint?: string; label: string }) {
  return (
    <label className="grid gap-2 text-sm font-medium text-slate-800">
      <span>{label}</span>
      {children}
      {hint ? <span className="text-xs font-normal leading-5 text-slate-500">{hint}</span> : null}
    </label>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "min-h-11 rounded-[var(--px-radius-sm)] border border-[color:var(--px-border)] bg-white px-3 py-2 text-sm text-[color:var(--px-text)] shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[color:var(--px-focus)] focus:ring-2 focus:ring-blue-500/20",
        props.className,
      )}
      {...props}
    />
  );
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "min-h-28 rounded-[var(--px-radius-sm)] border border-[color:var(--px-border)] bg-white px-3 py-2 text-sm text-[color:var(--px-text)] shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[color:var(--px-focus)] focus:ring-2 focus:ring-blue-500/20",
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
        "min-h-11 rounded-[var(--px-radius-sm)] border border-[color:var(--px-border)] bg-white px-3 py-2 text-sm text-[color:var(--px-text)] shadow-sm outline-none transition focus:border-[color:var(--px-focus)] focus:ring-2 focus:ring-blue-500/20",
        props.className,
      )}
      {...props}
    />
  );
}
