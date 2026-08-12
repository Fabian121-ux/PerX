"use client";

import { Clock, MapPin, ShieldCheck } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { FeedSaveButton } from "@/components/dashboard/feed-save-button";
import type { DashboardOpportunity } from "@/components/dashboard/types";
import { getCanonicalOpportunityPath } from "@/lib/data/opportunity-path";
import { formatBudgetRange } from "@/lib/money";
import { getAppRoute, getEnvironment } from "@/lib/navigation/app-routes";
import { trustBadgeClassName } from "@/lib/trust/engine";

interface RecommendedOpportunitiesProps {
  firstPageHref?: string | null;
  nextHref?: string | null;
  opportunities: DashboardOpportunity[];
  unavailable?: boolean;
}

export function RecommendedOpportunities({
  firstPageHref,
  nextHref,
  opportunities,
  unavailable = false,
}: RecommendedOpportunitiesProps) {
  const pathname = usePathname();
  const env = getEnvironment(pathname);

  return (
    <section aria-labelledby="opportunity-feed-heading" className="grid gap-4">
      <div className="flex items-end justify-between gap-4 px-1 sm:px-0">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[color:var(--px-primary)]">
            Across PerX
          </p>
          <h2
            className="mt-1 text-xl font-black tracking-tight text-[color:var(--px-text)]"
            id="opportunity-feed-heading"
          >
            Professional opportunities
          </h2>
        </div>
        <Link
          className="inline-flex min-h-11 items-center text-sm font-bold text-[color:var(--px-primary)] hover:text-[color:var(--px-primary-strong)] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)]"
          href={getAppRoute("discover", env)}
        >
          Explore all
        </Link>
      </div>

      {unavailable ? (
        <div
          className="rounded-[var(--px-radius)] border border-amber-300 bg-amber-50 p-6 text-sm leading-6 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100"
          role="alert"
        >
          <p className="font-black">The opportunity feed is unavailable.</p>
          <p className="mt-1">
            No substitute data is being shown. Refresh this page to try again.
          </p>
        </div>
      ) : opportunities.length ? (
        <div className="grid gap-4">
          {opportunities.map((opportunity) => (
            <OpportunityFeedCard
              key={opportunity.id}
              opportunity={opportunity}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-[var(--px-radius)] border border-dashed border-[color:var(--px-border-strong)] bg-[color:var(--px-surface)] p-8 text-center">
          <h3 className="font-black text-[color:var(--px-text)]">
            The opportunity feed is ready
          </h3>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[color:var(--px-text-muted)]">
            Eligible posts from other discoverable members will appear here as
            the network grows.
          </p>
        </div>
      )}

      {!unavailable && (firstPageHref || nextHref) ? (
        <nav
          aria-label="Opportunity feed pagination"
          className="flex items-center justify-end gap-2"
        >
          {firstPageHref ? (
            <Link
              className="inline-flex min-h-11 items-center rounded-[var(--px-radius-sm)] border border-[color:var(--px-border)] bg-[color:var(--px-surface)] px-4 text-sm font-bold text-[color:var(--px-text)] hover:border-[color:var(--px-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)]"
              href={firstPageHref}
            >
              Newest
            </Link>
          ) : null}
          {nextHref ? (
            <Link
              className="inline-flex min-h-11 items-center rounded-[var(--px-radius-sm)] bg-[color:var(--px-primary)] px-4 text-sm font-bold text-white hover:bg-[color:var(--px-primary-strong)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)]"
              href={nextHref}
            >
              Load next page
            </Link>
          ) : null}
        </nav>
      ) : null}
    </section>
  );
}

function OpportunityFeedCard({
  opportunity,
}: {
  opportunity: DashboardOpportunity;
}) {
  const detailHref = getCanonicalOpportunityPath(opportunity.slug);
  const authorHref = opportunity.authorUsername
    ? `/u/${opportunity.authorUsername}`
    : null;

  return (
    <article className="overflow-hidden rounded-[22px] border border-[color:var(--px-border)] bg-[color:var(--px-surface)] shadow-sm">
      <header className="flex items-start justify-between gap-3 px-4 pb-3 pt-4 sm:px-5 sm:pt-5">
        <div className="flex min-w-0 items-center gap-3">
          {opportunity.authorAvatarUrl ? (
            <Image
              alt={`${opportunity.organisation} profile photo`}
              className="h-11 w-11 shrink-0 rounded-full object-cover ring-1 ring-[color:var(--px-border)]"
              height={44}
              src={opportunity.authorAvatarUrl}
              width={44}
            />
          ) : (
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[color:var(--px-primary)] text-sm font-black text-white">
              {getInitials(opportunity.organisation)}
            </span>
          )}
          <div className="min-w-0">
            {authorHref ? (
              <Link
                className="block truncate text-sm font-black text-[color:var(--px-text)] hover:text-[color:var(--px-primary)] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)]"
                href={authorHref}
              >
                {opportunity.organisation}
              </Link>
            ) : (
              <p className="truncate text-sm font-black text-[color:var(--px-text)]">
                {opportunity.organisation}
              </p>
            )}
            <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-[color:var(--px-text-muted)]">
              <span>{opportunity.postedTimeAgo}</span>
              <span aria-hidden>·</span>
              <span>{opportunity.type.replaceAll("_", " ")}</span>
            </p>
          </div>
        </div>
        <span
          aria-label={`${opportunity.trust.shortLabel} trust level. ${opportunity.trust.description}`}
          className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-black ${trustBadgeClassName(
            opportunity.trust.level,
          )}`}
        >
          {opportunity.trust.shortLabel}
        </span>
      </header>

      <div className="px-4 pb-4 sm:px-5">
        <Link
          className="group block rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)]"
          href={detailHref}
        >
          <h3 className="text-lg font-black leading-7 text-[color:var(--px-text)] transition group-hover:text-[color:var(--px-primary)] sm:text-xl">
            {opportunity.title}
          </h3>
          <p className="mt-2 whitespace-pre-line text-sm leading-6 text-[color:var(--px-text-muted)]">
            {opportunity.summary}
          </p>
        </Link>
      </div>

      {opportunity.imageUrl ? (
        <Link
          aria-label={`Open ${opportunity.title}`}
          className="relative block aspect-[16/8] w-full overflow-hidden bg-[color:var(--px-muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[color:var(--px-focus)]"
          href={detailHref}
        >
          <Image
            alt={opportunity.imageAlt ?? `${opportunity.title} preview`}
            className="object-cover transition duration-300 hover:scale-[1.015] motion-reduce:transform-none"
            fill
            sizes="(max-width: 1024px) 100vw, 760px"
            src={opportunity.imageUrl}
          />
        </Link>
      ) : (
        <OpportunityGraphic title={opportunity.title} type={opportunity.type} />
      )}

      <div className="grid gap-3 px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-[color:var(--px-text-muted)]">
            <span className="inline-flex items-center gap-1.5">
              <MapPin aria-hidden size={14} />
              {opportunity.remote ? "Remote supported" : opportunity.location}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock aria-hidden size={14} />
              {opportunity.postedTimeAgo}
            </span>
          </div>
          <span className="font-black text-[color:var(--px-primary)]">
            {formatBudgetRange(
              opportunity.budgetMinMinor,
              opportunity.budgetMaxMinor,
              opportunity.currency,
            )}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-[color:var(--px-border)] pt-3">
          <FeedSaveButton
            initialSaved={opportunity.viewerHasSaved}
            opportunityId={opportunity.id}
          />
          <Link
            className="inline-flex min-h-11 items-center rounded-xl bg-[color:var(--px-primary)] px-4 text-sm font-bold text-white transition hover:bg-[color:var(--px-primary-strong)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)]"
            href={detailHref}
          >
            View opportunity
          </Link>
        </div>
      </div>
    </article>
  );
}

function OpportunityGraphic({ title, type }: { title: string; type: string }) {
  const offset = (title.length + type.length) % 28;
  return (
    <div
      aria-hidden
      className="relative h-36 w-full overflow-hidden bg-[linear-gradient(135deg,#061936_0%,#123466_55%,#5b46f2_100%)]"
    >
      <div className="absolute -right-8 -top-10 h-32 w-32 rounded-full bg-white/20 blur-2xl" />
      <div className="absolute bottom-5 left-5 h-12 w-12 rounded-full border border-white/40" />
      <div
        className="absolute inset-x-0 bottom-0 h-24 opacity-35"
        style={{
          backgroundImage:
            "linear-gradient(90deg, rgba(255,255,255,.28) 1px, transparent 1px), linear-gradient(0deg, rgba(255,255,255,.18) 1px, transparent 1px)",
          backgroundPosition: `${offset}px 0`,
          backgroundSize: "18px 18px",
        }}
      />
      <ShieldCheck
        className="absolute bottom-5 right-5 text-white"
        size={24}
      />
    </div>
  );
}

function getInitials(value: string) {
  return value
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
