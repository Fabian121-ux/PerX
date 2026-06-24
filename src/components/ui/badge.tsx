import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function Badge({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-[color:var(--px-border)] bg-slate-100 px-2.5 py-1 text-xs font-semibold text-[color:var(--px-text-muted)]",
        className,
      )}
    >
      {children}
    </span>
  );
}
