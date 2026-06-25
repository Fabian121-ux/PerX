import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn("perx-card p-5", className)}>{children}</section>;
}

export function EmptyState({ action, body, title }: { action?: ReactNode; body: string; title: string }) {
  return (
    <div className="rounded-[var(--px-radius)] border border-dashed border-[color:var(--px-border-strong)] bg-slate-100 p-8 text-center">
      <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-600">{body}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
