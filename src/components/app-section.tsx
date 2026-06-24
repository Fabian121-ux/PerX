import type { ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";

import { Card } from "@/components/ui/card";

export function AppSection({
  actions,
  children,
  description,
  title,
}: {
  actions?: ReactNode;
  children: ReactNode;
  description: string;
  title: string;
}) {
  return (
    <div className="grid gap-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-3xl font-bold text-slate-950">{title}</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{description}</p>
        </div>
        {actions}
      </div>
      {children}
    </div>
  );
}

export function MetricGrid({ items }: { items: { label: string; value: string | number; detail: string }[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item, index) => (
        <Card className="relative overflow-hidden" key={item.label}>
          <div
            aria-hidden
            className="absolute right-0 top-0 h-20 w-20 rounded-bl-[32px] opacity-80"
            style={{
              background:
                index % 4 === 0
                  ? "linear-gradient(135deg, rgba(15,76,129,.16), rgba(124,58,237,.1))"
                  : index % 4 === 1
                    ? "linear-gradient(135deg, rgba(245,158,11,.2), rgba(15,76,129,.08))"
                    : index % 4 === 2
                      ? "linear-gradient(135deg, rgba(34,197,94,.16), rgba(15,76,129,.08))"
                      : "linear-gradient(135deg, rgba(14,165,233,.16), rgba(124,58,237,.08))",
            }}
          />
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-[color:var(--px-text-muted)]">{item.label}</p>
            <span className="prex-soft-tile grid h-8 w-8 place-items-center rounded-[var(--px-radius-sm)]">
              <ArrowUpRight aria-hidden size={16} />
            </span>
          </div>
          <p className="mt-4 text-3xl font-black text-[color:var(--px-text)]">{item.value}</p>
          <p className="mt-2 text-xs leading-5 text-[color:var(--px-text-muted)]">{item.detail}</p>
        </Card>
      ))}
    </div>
  );
}
