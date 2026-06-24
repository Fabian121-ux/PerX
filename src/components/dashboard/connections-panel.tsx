"use client";

import { ShieldCheck } from "lucide-react";
import type { DashboardConnection } from "./types";
import { FeatureStatusDialog } from "@/components/shared/feature-status-dialog";

export function ConnectionsPanel({ connections }: { connections: DashboardConnection[] }) {
  const getInitials = (name: string) =>
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .substring(0, 2)
      .toUpperCase();

  return (
    <div className="rounded-[24px] bg-[color:var(--px-surface)] p-6 shadow-sm ring-1 ring-[color:var(--px-border)] transition-colors duration-200">
      <div className="flex items-center justify-between border-b border-[color:var(--px-border)] pb-4">
        <h3 className="font-bold text-[color:var(--px-text)]">Your Connections</h3>
        <FeatureStatusDialog featureName="Connections network">
          <button className="inline-flex min-h-10 items-center text-xs font-semibold text-[color:var(--px-primary)] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)]">
            See all
          </button>
        </FeatureStatusDialog>
      </div>

      <div className="mt-4 flex flex-col gap-4">
        {connections.map((conn) => (
          <div key={conn.id} className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[color:var(--px-surface-soft)] font-bold text-[color:var(--px-gold-soft)] ring-1 ring-[color:var(--px-primary)]/35">
                {getInitials(conn.name)}
                {conn.isOnline && (
                  <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-green-500 ring-2 ring-[color:var(--px-surface)]" />
                )}
                {!conn.isOnline && (
                  <span className="absolute bottom-0 right-0 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[color:var(--px-surface)] ring-1 ring-[color:var(--px-border-strong)]">
                    <ShieldCheck size={8} className="text-[color:var(--px-gold)]" />
                  </span>
                )}
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold text-[color:var(--px-text)]">{conn.name}</span>
                <span className="text-[10px] text-[color:var(--px-text-muted)]">{conn.role}</span>
              </div>
            </div>
            <span className="h-1.5 w-1.5 rounded-full bg-green-500" aria-hidden />
          </div>
        ))}
      </div>
    </div>
  );
}
