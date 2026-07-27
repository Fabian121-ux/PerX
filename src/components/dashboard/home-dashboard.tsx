"use client";

import {
  Bookmark,
  Bell,
  BriefcaseBusiness,
  CheckCircle2,
  Handshake,
  MessageSquare,
  PlusCircle,
  ShieldCheck,
  FileText,
  Search,
  UsersRound,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { HomeDashboardData } from "./types";

import { getAppRoute, getEnvironment } from "@/lib/navigation/app-routes";

import { ConnectionStrip } from "./connection-strip";
import { TrustHeroCard } from "./trust-hero-card";
import { DashboardMetricCard } from "./dashboard-metric-card";
import { QuickActions } from "./quick-actions";
import { RecommendedProfiles } from "./recommended-profiles";
import { RecommendedOpportunities } from "./recommended-opportunities";
import { ActivityFeed } from "./activity-feed";
import { Card } from "@/components/ui/card";
import { dismissOnboardingChecklistAction } from "@/features/onboarding/actions";

export function HomeDashboard({ data }: { data: HomeDashboardData }) {
  const pathname = usePathname();
  const env = getEnvironment(pathname);
  const getHref = (key: Parameters<typeof getAppRoute>[0]) =>
    getAppRoute(key, env);

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      {/* Main Content Column */}
      <div className="flex min-w-0 flex-col gap-6">
        <Link
          href={getHref("discover")}
          className="flex h-12 w-full items-center gap-3 rounded-[var(--px-radius-sm)] border border-[color:var(--px-border)] bg-[color:var(--px-muted)] px-4 text-left transition-colors hover:border-[color:var(--px-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)] sm:hidden"
        >
          <Search
            size={18}
            className="shrink-0 text-[color:var(--px-primary)]"
          />
          <span className="min-w-0 truncate text-sm font-medium text-[color:var(--px-text-muted)]">
            Search opportunities, people and startups...
          </span>
        </Link>

        <Card className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <div>
            <p className="text-sm font-bold uppercase tracking-wide text-[color:var(--px-primary)]">
              Home
            </p>
            <h1 className="mt-2 text-3xl font-black text-[color:var(--px-text)]">
              Welcome, {data.user.name.split(" ")[0]}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[color:var(--px-text-muted)]">
              Your PerX home shows what needs attention and gives you fast
              paths to discovery, services, people, messages, and posts.
            </p>
          </div>
          <Link
            className="inline-flex min-h-11 items-center justify-center rounded-[var(--px-radius-sm)] bg-[color:var(--px-primary)] px-4 text-sm font-bold text-white transition hover:bg-[color:var(--px-primary-strong)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)]"
            href={getHref("discover")}
          >
            Discover
          </Link>
        </Card>

        {!data.onboarding.dismissed &&
        data.onboarding.items.some((item) => !item.complete) ? (
          <Card className="border-[color:var(--px-primary)]/30 bg-[color:var(--px-primary-soft)]">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-[color:var(--px-primary)]">
                  First steps
                </p>
                <h2 className="mt-1 text-lg font-black text-[color:var(--px-text)]">
                  Set up your PerX presence
                </h2>
                <p className="mt-1 text-sm leading-6 text-[color:var(--px-text-muted)]">
                  Complete these when you are ready. Dismissing the checklist
                  stores the preference on your account.
                </p>
              </div>
              <form action={dismissOnboardingChecklistAction}>
                <button
                  aria-label="Dismiss first steps"
                  className="grid h-11 w-11 place-items-center rounded-full text-[color:var(--px-text-muted)] transition hover:bg-[color:var(--px-surface)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)]"
                  type="submit"
                >
                  <X aria-hidden size={18} />
                </button>
              </form>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {data.onboarding.items.map((item) => (
                <Link
                  className="flex min-h-11 items-center gap-3 rounded-[var(--px-radius-sm)] bg-[color:var(--px-surface)] px-3 py-2 text-sm font-semibold text-[color:var(--px-text)] ring-1 ring-[color:var(--px-border)] transition hover:border-[color:var(--px-primary)] hover:text-[color:var(--px-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)]"
                  href={item.href}
                  key={item.label}
                >
                  <CheckCircle2
                    aria-hidden
                    className={
                      item.complete
                        ? "text-emerald-600"
                        : "text-[color:var(--px-text-muted)]"
                    }
                    size={17}
                  />
                  <span>{item.label}</span>
                </Link>
              ))}
            </div>
          </Card>
        ) : null}

        <TrustHeroCard />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <DashboardMetricCard
            title="Unread messages"
            value={data.unreadMessagesCount}
            detail="Unread conversations"
            actionLabel="Open messages"
            href={getHref("messages")}
            icon={<MessageSquare size={20} />}
          />
          <DashboardMetricCard
            title="Notifications"
            value={data.notificationsCount}
            detail="Unread updates"
            actionLabel="View notifications"
            href={getHref("notifications")}
            icon={<Bell size={20} />}
          />
          <DashboardMetricCard
            title="Requests"
            value={data.connectionRequestsCount}
            detail="Incoming connection requests"
            actionLabel="Review requests"
            href="/app/connections/requests"
            icon={<UsersRound size={20} />}
          />
          <DashboardMetricCard
            title="Trust"
            value={data.trust.shortLabel}
            detail={data.trust.description}
            actionLabel="View breakdown"
            href={getHref("reviews")}
            icon={
              <ShieldCheck size={20} className="text-[color:var(--px-gold)]" />
            }
          />
          <DashboardMetricCard
            title="Deals"
            value={data.activeDealsCount}
            detail={data.activeDealsDetail || "In progress"}
            actionLabel="View deals"
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
          <DashboardMetricCard
            title="Drafts"
            value={data.draftsCount}
            detail="Saved unpublished posts"
            actionLabel="Manage drafts"
            href="/app/manage?status=DRAFT"
            icon={<FileText size={20} />}
          />
          <DashboardMetricCard
            title="Published"
            value={data.publishedItemsCount}
            detail="Live posts"
            actionLabel="Manage posts"
            href={getHref("manage")}
            icon={<BriefcaseBusiness size={20} />}
          />
        </div>

        <QuickActions />

        <RecommendedOpportunities
          opportunities={data.recommendedOpportunities}
        />

        <RecommendedProfiles profiles={data.recommendedProfiles} />

        {data.activityFeed && data.activityFeed.length > 0 && (
          <ActivityFeed feed={data.activityFeed} />
        )}

        <ConnectionStrip connections={data.connections} user={data.user} />
      </div>

      {/* Right Information Rail */}
      <div className="flex flex-col gap-6 xl:sticky xl:top-24 xl:self-start">
        <ProfileCompletionCard
          value={data.user.profile?.profileCompleteness ?? 0}
        />
        <WorkspaceQueueCard
          body="Open your real conversation list directly. Message counts are separate from notifications."
          href={getHref("messages")}
          icon={<MessageSquare aria-hidden size={18} />}
          title="Recent messages"
        />
        <WorkspaceQueueCard
          body="Create opportunities, services, property listings, and other implemented PerX posts."
          href="/app/opportunities/new"
          icon={<PlusCircle aria-hidden size={18} />}
          title="Create content"
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
