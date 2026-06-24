"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getAppRoute, getEnvironment } from "@/lib/navigation/app-routes";
import { ShieldCheck } from "lucide-react";
import type { DashboardRecommendedProfile } from "./types";
import { FeatureStatusDialog } from "@/components/shared/feature-status-dialog";

export function RecommendedProfiles({ profiles }: { profiles: DashboardRecommendedProfile[] }) {
  const pathname = usePathname();
  const env = getEnvironment(pathname);

  const getInitials = (name: string) =>
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .substring(0, 2)
      .toUpperCase();

  return (
    <div className="relative overflow-hidden rounded-[24px] bg-[color:var(--px-surface)] p-6 shadow-[var(--px-shadow)] ring-1 ring-[color:var(--px-border)] transition-colors duration-200">
      <div className="pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full bg-[color:var(--px-gold)]/18 blur-3xl" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[color:var(--px-primary-soft)] to-transparent" aria-hidden="true" />
      <div className="flex items-center justify-between">
        <h2 className="relative text-lg font-bold text-[color:var(--px-text)]">People to connect with</h2>
        <Link href={`${getAppRoute("discover", env)}?type=PEOPLE`} className="relative inline-flex min-h-10 items-center text-sm font-semibold text-[color:var(--px-primary)] hover:text-[color:var(--px-primary-strong)]">
          See all
        </Link>
      </div>

      <div className="dashboard-scroll relative -mx-6 mt-6 flex gap-4 overflow-x-auto px-6 pb-4 scrollbar-hide">
        {profiles.map((profile) => (
          <div
            key={profile.id}
            className="flex w-[240px] shrink-0 snap-start flex-col items-center justify-center rounded-2xl bg-[color:var(--px-surface-soft)] p-5 text-center backdrop-blur-sm ring-1 ring-[color:var(--px-border)] transition-colors hover:ring-[color:var(--px-primary)]/55"
          >
            <div className="relative mb-3">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#090909] text-xl font-bold text-[color:var(--px-gold-soft)] ring-2 ring-[color:var(--px-primary)]/55">
                {getInitials(profile.name)}
              </div>
              {profile.trustScore > 80 && (
                <div className="absolute bottom-0 right-0 flex h-5 w-5 items-center justify-center rounded-full bg-[color:var(--px-surface)] ring-2 ring-[color:var(--px-primary)]">
                  <ShieldCheck size={12} className="text-[color:var(--px-gold)]" />
                </div>
              )}
            </div>
            <h3 className="text-sm font-bold text-[color:var(--px-text)]">{profile.name}</h3>
            <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-[color:var(--px-text-muted)]">
              {profile.role}
            </p>
            <p className="mt-2 line-clamp-2 text-xs text-[color:var(--px-text-muted)]">{profile.headline}</p>
            <FeatureStatusDialog featureName={`Connect with ${profile.name}`}>
              <button className="mt-4 w-full rounded-full bg-[color:var(--px-primary)] px-4 py-2 text-xs font-bold text-[#070707] transition-colors hover:bg-[color:var(--px-primary-strong)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)]">
                Connect
              </button>
            </FeatureStatusDialog>
          </div>
        ))}
      </div>
    </div>
  );
}
