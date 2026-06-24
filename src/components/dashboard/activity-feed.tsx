"use client";

import type { DashboardActivity } from "./types";
import { FeatureStatusDialog } from "@/components/shared/feature-status-dialog";

export function ActivityFeed({ feed }: { feed: DashboardActivity[] }) {
  return (
    <div className="rounded-[24px] bg-[color:var(--px-surface)] p-6 shadow-sm ring-1 ring-[color:var(--px-border)] transition-colors duration-200">
      <div className="flex items-center justify-between border-b border-[color:var(--px-border)] pb-4">
        <h3 className="font-bold text-[color:var(--px-text)]">Activity Feed</h3>
        <FeatureStatusDialog featureName="General notifications">
          <button className="inline-flex min-h-10 items-center text-xs font-semibold text-[color:var(--px-primary)] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)]">
            See all
          </button>
        </FeatureStatusDialog>
      </div>

      <div className="mt-4 flex flex-col gap-5">
        {feed.map((activity) => (
          <div key={activity.id} className="flex gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[color:var(--px-primary)] text-xs font-bold text-[#070707]">
              {activity.initials || "pX"}
            </div>
            <div className="flex flex-col">
              <p className="text-sm text-[color:var(--px-text-muted)]">{activity.message}</p>
              <span className="mt-0.5 text-xs opacity-70 text-[color:var(--px-text-muted)]">{activity.timeAgo}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
