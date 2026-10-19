import type { ElementType, ReactNode } from "react";

import { cn } from "@/lib/utils";

export function Card({
  as: Component = "section",
  children,
  className,
}: {
  as?: ElementType;
  children: ReactNode;
  className?: string;
}) {
  return <Component className={cn("ptahx-card p-5", className)}>{children}</Component>;
}

export function EmptyState({ action, body, title }: { action?: ReactNode; body: string; title: string }) {
  return (
    <div className="rounded-[var(--px-radius)] border border-dashed border-[color:var(--px-border-strong)] bg-[color:var(--px-surface-soft)] p-8 text-center">
      <h2 className="text-lg font-semibold text-[color:var(--px-text)]">{title}</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[color:var(--px-text-muted)]">{body}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
