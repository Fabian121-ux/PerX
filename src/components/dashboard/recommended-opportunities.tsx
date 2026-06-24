"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { getAppRoute, getEnvironment } from "@/lib/navigation/app-routes";
import { Bookmark, MapPin, ShieldCheck, Clock } from "lucide-react";
import type { DashboardOpportunity } from "./types";
import { formatBudgetRange } from "@/lib/money";

interface RecommendedOpportunitiesProps {
  opportunities: DashboardOpportunity[];
}

export function RecommendedOpportunities({ opportunities }: RecommendedOpportunitiesProps) {
  const pathname = usePathname();
  const env = getEnvironment(pathname);
  if (!opportunities || opportunities.length === 0) return null;

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between px-2 sm:px-0">
        <h2 className="text-xl font-bold tracking-tight text-[color:var(--px-text)]">Recommended for you</h2>
        <Link href={getAppRoute("discover", env)} className="inline-flex min-h-10 items-center text-sm font-semibold text-[color:var(--px-primary)] hover:text-[color:var(--px-primary-strong)] hover:underline">
          See all
        </Link>
      </div>

      <div className="dashboard-scroll -mx-4 mt-4 flex gap-4 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6 lg:mx-0 lg:grid lg:w-full lg:grid-cols-2 lg:overflow-visible lg:px-0 lg:pb-0 xl:grid-cols-3">
        {opportunities.map((opp) => (
          <article
            key={opp.id}
            className="dashboard-scroll-card group relative flex min-h-[338px] shrink-0 snap-start flex-col overflow-hidden rounded-[20px] bg-[color:var(--px-surface)] shadow-sm ring-1 ring-[color:var(--px-border)] transition-all hover:-translate-y-0.5 hover:shadow-[0_18px_44px_rgba(0,0,0,0.32)] hover:ring-[color:var(--px-primary)]/55 lg:min-w-0 lg:w-auto"
          >
            <Link href={`${getAppRoute("discover", env)}?opportunity=${opp.slug}`} className="flex h-full flex-col">
            <div className="relative h-28 w-full overflow-hidden bg-[color:var(--px-muted)]">
              {opp.imageUrl ? (
                <Image
                  src={opp.imageUrl}
                  alt={opp.title}
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                  sizes="(max-width: 640px) 300px, (max-width: 1536px) 50vw, 33vw"
                />
              ) : (
                <OpportunityGraphic title={opp.title} type={opp.type} />
              )}
              <div className="absolute left-3 top-3">
                <span className="rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-bold tracking-wide text-white backdrop-blur-md">
                  {opp.type.replace("_", " ")}
                </span>
              </div>
            </div>

            <div className="flex flex-1 flex-col p-4">
              <h3 className="line-clamp-2 text-base font-bold leading-tight text-[color:var(--px-text)] group-hover:text-[color:var(--px-primary)]">
                {opp.title}
              </h3>
              <p className="mt-1 flex items-center gap-1 text-xs font-medium text-[color:var(--px-text-muted)]">
                {opp.organisation}
                <ShieldCheck size={12} className="text-[color:var(--px-gold)]" />
              </p>

              <div className="mt-auto pt-4">
                <div className="flex items-center gap-3 text-xs text-[color:var(--px-text-muted)]">
                  <div className="flex items-center gap-1">
                    <MapPin size={12} />
                    <span>{opp.remote ? "Remote" : opp.location}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock size={12} />
                    <span>{opp.postedTimeAgo}</span>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-[color:var(--px-border)] pt-3">
                  <span className="font-black text-[color:var(--px-primary)]">
                    {formatBudgetRange(opp.budgetMinMinor, opp.budgetMaxMinor, opp.currency)}
                  </span>
                </div>
              </div>
            </div>
            </Link>
            <button
              className="absolute right-3 top-3 rounded-full bg-black/55 p-2 text-[color:var(--px-gold-soft)] backdrop-blur-md transition-colors hover:bg-black/75 hover:text-[color:var(--px-gold-bright)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)]"
              aria-label="Save opportunity"
              type="button"
            >
              <Bookmark size={16} />
            </button>
          </article>
        ))}
      </div>
    </div>
  );
}

function OpportunityGraphic({ title, type }: { title: string; type: string }) {
  const seed = title.length + type.length;
  const offset = seed % 28;

  return (
    <div className="relative h-full w-full overflow-hidden bg-[linear-gradient(135deg,#0a0a0a_0%,#1b1b1f_52%,#31250d_100%)]">
      <div className="absolute -right-8 -top-10 h-32 w-32 rounded-full bg-[color:var(--px-gold)]/25 blur-2xl" />
      <div className="absolute bottom-4 left-4 h-12 w-12 rounded-full border border-[color:var(--px-primary)]/40" />
      <div
        className="absolute inset-x-0 bottom-0 h-20 opacity-35"
        style={{
          backgroundImage:
            "linear-gradient(90deg, rgba(245,185,66,.32) 1px, transparent 1px), linear-gradient(0deg, rgba(245,185,66,.22) 1px, transparent 1px)",
          backgroundPosition: `${offset}px 0`,
          backgroundSize: "18px 18px",
        }}
      />
      <div className="absolute bottom-5 right-5 flex h-11 w-11 items-center justify-center rounded-2xl border border-[color:var(--px-primary)]/35 bg-black/25 text-[color:var(--px-gold-soft)]">
        <ShieldCheck size={20} />
      </div>
    </div>
  );
}
