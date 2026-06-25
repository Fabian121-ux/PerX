"use client";

import { Plus, ShieldCheck } from "lucide-react";

import type { DashboardConnection, HomeDashboardData } from "@/components/dashboard/types";
import { FeatureStatusDialog } from "@/components/shared/feature-status-dialog";

export function ConnectionStrip({
  connections,
  user,
}: {
  connections: DashboardConnection[];
  user: HomeDashboardData["user"];
}) {
  const getInitials = (name: string) =>
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .substring(0, 2)
      .toUpperCase();

  return (
    <section aria-label="People in your opportunity network" className="dashboard-scroll -mx-4 overflow-x-auto px-4 pb-4 pt-2 scrollbar-hide sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0">
      <div className="flex w-max gap-4 sm:gap-6">
        {/* Current User Item */}
        <FeatureStatusDialog featureName="View profile">
          <button className="group flex flex-col items-center gap-2 focus:outline-none snap-start shrink-0">
            <div className="relative">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[color:var(--px-surface-soft)] ring-2 ring-[color:var(--px-border)] transition-transform group-hover:scale-105">
                <span className="text-xl font-bold text-[color:var(--px-text)]">
                  {getInitials(user.name)}
                </span>
              </div>
              <div className="absolute bottom-0 right-0 flex h-5 w-5 items-center justify-center rounded-full bg-[color:var(--px-primary)] ring-2 ring-[color:var(--px-surface)]">
                <Plus size={12} className="text-white" />
              </div>
            </div>
            <span className="text-xs font-medium text-[color:var(--px-text)]">Your profile</span>
          </button>
        </FeatureStatusDialog>

        {/* Connections */}
        {connections.map((conn) => (
          <FeatureStatusDialog key={conn.id} featureName={`View ${conn.name}'s profile`}>
            <button className="group flex flex-col items-center gap-2 focus:outline-none snap-start shrink-0">
            <div className="relative">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[color:var(--px-surface-soft)] ring-2 ring-[color:var(--px-primary)] ring-offset-2 ring-offset-[color:var(--px-page)] transition-transform group-hover:scale-105">
                <span className="text-xl font-bold text-[color:var(--px-primary)]">
                  {getInitials(conn.name)}
                </span>
              </div>
              {conn.isOnline && (
                <div className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full bg-green-500 ring-2 ring-[color:var(--px-surface)]" />
              )}
              {/* Optional verification indicator */}
              {!conn.isOnline && (
                <div className="absolute bottom-0 right-0 flex h-4 w-4 items-center justify-center rounded-full bg-[color:var(--px-surface)] ring-1 ring-[color:var(--px-border-strong)]">
                  <ShieldCheck size={10} className="text-[color:var(--px-success)]" />
                </div>
              )}
            </div>
            <span className="text-xs font-medium text-[color:var(--px-text)]">{conn.name.split(" ")[0]}</span>
          </button>
          </FeatureStatusDialog>
        ))}
      </div>
    </section>
  );
}
