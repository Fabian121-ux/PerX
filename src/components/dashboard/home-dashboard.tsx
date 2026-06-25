"use client";

import { Wallet, ShieldCheck, FileText, Search } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { HomeDashboardData } from "./types";
import { FeatureStatusDialog } from "@/components/shared/feature-status-dialog";
import { getAppRoute, getEnvironment } from "@/lib/navigation/app-routes";

import { ConnectionStrip } from "./connection-strip";
import { TrustHeroCard } from "./trust-hero-card";
import { DashboardMetricCard } from "./dashboard-metric-card";
import { QuickActions } from "./quick-actions";
import { RecommendedProfiles } from "./recommended-profiles";
import { RecommendedOpportunities } from "./recommended-opportunities";
import { ActivityFeed } from "./activity-feed";
import { OpportunityTrends } from "./opportunity-trends";
import { ConnectionsPanel } from "./connections-panel";

export function HomeDashboard({ data }: { data: HomeDashboardData }) {
  const pathname = usePathname();
  const env = getEnvironment(pathname);
  const getHref = (key: Parameters<typeof getAppRoute>[0]) => getAppRoute(key, env);

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      {/* Main Content Column */}
      <div className="flex min-w-0 flex-col gap-6">
        <FeatureStatusDialog featureName="Search functionality">
          <button className="flex h-12 w-full items-center gap-3 rounded-[var(--px-radius-sm)] border border-[color:var(--px-border)] bg-[color:var(--px-muted)] px-4 text-left transition-colors hover:border-[color:var(--px-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)] sm:hidden">
            <Search size={18} className="shrink-0 text-[color:var(--px-primary)]" />
            <span className="min-w-0 truncate text-sm font-medium text-[color:var(--px-text-muted)]">
              Search opportunities, people and startups...
            </span>
          </button>
        </FeatureStatusDialog>

        <TrustHeroCard />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <DashboardMetricCard
            title="Trust Score"
            value={data.trustScore !== null ? `${data.trustScore}/100` : "New"}
            detail={data.trustScore && data.trustScore > 80 ? "Strong profile" : "Building reputation"}
            actionLabel="View breakdown"
            href={getHref("reviews")}
            icon={<ShieldCheck size={20} className="text-[color:var(--px-gold)]" />}
          />
          <DashboardMetricCard
            title="Active Deals"
            value={data.activeDealsCount}
            detail={data.activeDealsDetail || "In progress"}
            actionLabel="View deals"
            href={getHref("deals")}
            icon={<Wallet size={20} />}
          />
          <DashboardMetricCard
            title="Open Proposals"
            value={data.openProposalsCount}
            detail={data.openProposalsDetail || "Awaiting response"}
            actionLabel="Review proposals"
            href={getHref("proposals_sent")}
            icon={<FileText size={20} />}
          />
        </div>

        <QuickActions />

        <RecommendedOpportunities opportunities={data.recommendedOpportunities} />

        <RecommendedProfiles profiles={data.recommendedProfiles} />

        <ConnectionStrip connections={data.connections} user={data.user} />

        {/* Lower Call-to-action Cards */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Link href={getHref("new_opportunity")} className="group flex flex-col justify-between rounded-[20px] bg-[color:var(--px-surface-soft)] p-6 ring-1 ring-[color:var(--px-border)] transition-colors hover:border-[color:var(--px-primary)] hover:bg-[color:var(--px-surface-elevated)]">
            <div>
              <h3 className="font-bold text-[color:var(--px-text)] group-hover:text-[color:var(--px-primary)]">I need an expert</h3>
              <p className="mt-2 text-xs text-[color:var(--px-text-muted)]">Post a project and connect with trusted professionals.</p>
            </div>
            <span className="mt-6 flex items-center text-xs font-bold text-[color:var(--px-primary)]">
              Post an opportunity &rarr;
            </span>
          </Link>
          <Link href={getHref("discover")} className="group flex flex-col justify-between rounded-[20px] bg-[color:var(--px-surface-soft)] p-6 ring-1 ring-[color:var(--px-border)] transition-colors hover:border-[color:var(--px-primary)] hover:bg-[color:var(--px-surface-elevated)]">
            <div>
              <h3 className="font-bold text-[color:var(--px-text)] group-hover:text-[color:var(--px-primary)]">I want to work</h3>
              <p className="mt-2 text-xs text-[color:var(--px-text-muted)]">Discover projects that match your skills and interests.</p>
            </div>
            <span className="mt-6 flex items-center text-xs font-bold text-[color:var(--px-primary)]">
              Find opportunities &rarr;
            </span>
          </Link>
          <FeatureStatusDialog featureName="Startup discovery">
            <button className="group flex w-full flex-col justify-between rounded-[20px] bg-[color:var(--px-surface-soft)] p-6 text-left ring-1 ring-[color:var(--px-border)] transition-colors hover:border-[color:var(--px-primary)] hover:bg-[color:var(--px-surface-elevated)]">
              <div>
                <h3 className="font-bold text-[color:var(--px-text)] group-hover:text-[color:var(--px-primary)]">I am building a startup</h3>
                <p className="mt-2 text-xs text-[color:var(--px-text-muted)]">Find collaborators, talent and ecosystem support.</p>
              </div>
              <span className="mt-6 flex items-center text-xs font-bold text-[color:var(--px-primary)]">
                Explore startup tools &rarr;
              </span>
            </button>
          </FeatureStatusDialog>
        </div>
      </div>

      {/* Right Information Rail */}
      <div className="flex flex-col gap-6 xl:sticky xl:top-24 xl:self-start">
        <ActivityFeed feed={data.activityFeed} />
        <OpportunityTrends trends={data.opportunityTrends} />
        <ConnectionsPanel connections={data.connections} />
      </div>
    </div>
  );
}
