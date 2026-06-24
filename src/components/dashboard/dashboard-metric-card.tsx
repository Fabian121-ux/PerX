"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";

export function DashboardMetricCard({
  title,
  value,
  detail,
  actionLabel,
  href,
  icon,
}: {
  title: string;
  value: string | number;
  detail: string;
  actionLabel: string;
  href: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col justify-between rounded-[24px] bg-[color:var(--px-surface)] p-6 shadow-sm ring-1 ring-[color:var(--px-border)] transition-colors duration-200">
      <div>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[color:var(--px-text-muted)]">{title}</h3>
          {icon && <div className="text-[color:var(--px-text-muted)]">{icon}</div>}
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-3xl font-black text-[color:var(--px-text)]">{value}</span>
        </div>
        <p className="mt-1 text-xs font-medium text-[color:var(--px-text-muted)]">{detail}</p>
      </div>
      <div className="mt-6">
        <Link
          href={href}
          className="inline-flex items-center gap-1 text-xs font-bold text-[color:var(--px-primary)] transition-colors hover:text-[color:var(--px-primary-strong)]"
        >
          {actionLabel}
          <ChevronRight size={14} />
        </Link>
      </div>
    </div>
  );
}
