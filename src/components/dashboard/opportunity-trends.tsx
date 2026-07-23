"use client";

import { ArrowUpRight, TrendingUp } from "lucide-react";
import Link from "next/link";
import type { DashboardTrend } from "./types";

export function OpportunityTrends({ trends }: { trends: DashboardTrend[] }) {
  return (
    <div className="rounded-[24px] bg-[color:var(--px-surface)] p-6 shadow-sm ring-1 ring-[color:var(--px-border)] transition-colors duration-200">
      <div className="flex items-center justify-between border-b border-[color:var(--px-border)] pb-4">
        <h3 className="font-bold text-[color:var(--px-text)]">Opportunity Trends</h3>
        <Link
          className="inline-flex min-h-10 items-center text-xs font-semibold text-[color:var(--px-primary)] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)]"
          href="/app/discover"
        >
          See all
        </Link>
      </div>

      <div className="mt-4 flex flex-col gap-4">
        {trends.map((trend) => (
          <div key={trend.id} className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${trend.isUp ? "bg-green-500/10 text-[color:var(--px-success)]" : "bg-[color:var(--px-primary-soft)] text-[color:var(--px-primary)]"}`}>
                <TrendingUp size={18} className={trend.isUp ? "" : "rotate-180"} />
              </div>
              <span className="text-sm font-semibold text-[color:var(--px-text)]">{trend.label}</span>
            </div>
            <div className="flex flex-col items-end">
              <span className={`flex items-center gap-1 text-xs font-bold ${trend.isUp ? "text-[color:var(--px-success)]" : "text-[color:var(--px-primary)]"}`}>
                {trend.isUp ? <ArrowUpRight size={12} /> : <ArrowUpRight size={12} className="rotate-90" />}
                {trend.percentage}
              </span>
              <span className="text-[10px] text-[color:var(--px-text-muted)]">vs last month</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
