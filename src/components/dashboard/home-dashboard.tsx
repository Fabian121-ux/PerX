"use client";

import {
  Bookmark,
  CheckCircle2,
  Handshake,
  MessageSquare,
  ShieldCheck,
  FileText,
  Search,
} from "lucide-react";
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
import { Card } from "@/components/ui/card";

export function HomeDashboard({ data }: { data: HomeDashboardData }) {
  const pathname = usePathname();
  const env = getEnvironment(pathname);
  const getHref = (key: Parameters<typeof getAppRoute>[0]) =>
    getAppRoute(key, env);

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      {/* Main Content Column */}
      <div className="flex min-w-0 flex-col gap-6">
        <FeatureStatusDialog featureName="Search functionality">
          <button className="flex h-12 w-full items-center gap-3 rounded-[var(--px-radius-sm)] border border-[color:var(--px-border)] bg-[color:var(--px-muted)] px-4 text-left transition-colors hover:border-[color:var(--px-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)] sm:hidden">
            <Search
              size={18}
              className="shrink-0 text-[color:var(--px-primary)]"
            />
            <span className="min-w-0 truncate text-sm font-medium text-[color:var(--px-text-muted)]">
              Search opportunities, people and startups...
            </span>
          </button>
        </FeatureStatusDialog>

        <Card className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <div>
            <p className="text-sm font-bold uppercase tracking-wide text-[color:var(--px-primary)]">
              Welcome
            </p>
            <h1 className="mt-2 text-3xl font-black text-[color:var(--px-text)]">
              Welcome, {data.user.name.split(" ")[0]}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[color:var(--px-text-muted)]">
              Search, respond to opportunities, manage proposals and keep your
              agreement workspaces clear.
            </p>
          </div>
          <Link
            className="inline-flex min-h-11 items-center justify-center rounded-[var(--px-radius-sm)] bg-[color:var(--px-primary)] px-4 text-sm font-bold text-white transition hover:bg-[color:var(--px-primary-strong)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)]"
            href={getHref("discover")}
          >
            Search PerX
          </Link>
        </Card>

        <TrustHeroCard />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <DashboardMetricCard
            title="Trust Score"
            value={data.trustScore !== null ? `${data.trustScore}/100` : "New"}
            detail={
              data.trustScore && data.trustScore > 80
                ? "Strong profile"
                : "Building reputation"
            }
            actionLabel="View breakdown"
            href={getHref("reviews")}
            icon={
              <ShieldCheck size={20} className="text-[color:var(--px-gold)]" />
            }
          />
          <DashboardMetricCard
            title="Agreements"
            value={data.activeDealsCount}
            detail={data.activeDealsDetail || "In progress"}
            actionLabel="View agreements"
            href={getHref("deals")}
            icon={<Handshake size={20} />}
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

        <RecommendedOpportunities
          opportunities={data.recommendedOpportunities}
        />

        <RecommendedProfiles profiles={data.recommendedProfiles} />

        <ConnectionStrip connections={data.connections} user={data.user} />
      </div>

      {/* Right Information Rail */}
      <div className="flex flex-col gap-6 xl:sticky xl:top-24 xl:self-start">
        <ProfileCompletionCard
          value={data.user.profile?.profileCompleteness ?? 0}
        />
        <WorkspaceQueueCard
          body="Recent conversations will appear when a proposal or listing creates a shared workspace."
          href={getHref("messages")}
          icon={<MessageSquare aria-hidden size={18} />}
          title="Recent messages"
        />
        <WorkspaceQueueCard
          body="Saved people, opportunities and listings will appear here after you save them."
          href={getHref("saved")}
          icon={<Bookmark aria-hidden size={18} />}
          title="Saved items"
        />
      </div>
    </div>
  );
}

function ProfileCompletionCard({ value }: { value: number }) {
  const width = `${Math.max(0, Math.min(value, 100))}%`;

  return (
    <Card>
      <div className="flex items-start gap-3">
        <span className="perx-soft-tile grid h-10 w-10 place-items-center rounded-[var(--px-radius-sm)]">
          <CheckCircle2 aria-hidden size={18} />
        </span>
        <div className="min-w-0">
          <h2 className="font-black text-[color:var(--px-text)]">
            Profile completion
          </h2>
          <p className="mt-1 text-sm leading-6 text-[color:var(--px-text-muted)]">
            {value >= 80
              ? "Your profile is ready for stronger discovery."
              : "Add your photo, location, introduction and skills."}
          </p>
        </div>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-[color:var(--px-muted)]">
        <div
          className="h-full rounded-full bg-[color:var(--px-primary)]"
          style={{ width }}
        />
      </div>
      <Link
        className="mt-4 inline-flex min-h-10 items-center text-sm font-bold text-[color:var(--px-primary)] hover:text-[color:var(--px-primary-strong)]"
        href="/app/profile/edit"
      >
        Update profile
      </Link>
    </Card>
  );
}

function WorkspaceQueueCard({
  body,
  href,
  icon,
  title,
}: {
  body: string;
  href: string;
  icon: React.ReactNode;
  title: string;
}) {
  return (
    <Card>
      <div className="flex items-start gap-3">
        <span className="perx-soft-tile grid h-10 w-10 place-items-center rounded-[var(--px-radius-sm)]">
          {icon}
        </span>
        <div>
          <h2 className="font-black text-[color:var(--px-text)]">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-[color:var(--px-text-muted)]">
            {body}
          </p>
        </div>
      </div>
      <Link
        className="mt-4 inline-flex min-h-10 items-center text-sm font-bold text-[color:var(--px-primary)] hover:text-[color:var(--px-primary-strong)]"
        href={href}
      >
        Open
      </Link>
    </Card>
  );
}
