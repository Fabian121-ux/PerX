import Link from "next/link";
import { Bookmark, MapPin, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatBudgetRange } from "@/lib/money";

type OpportunityCardProps = {
  opportunity: {
    slug: string;
    title: string;
    summary: string;
    type: string;
    location?: string | null;
    remote?: boolean;
    budgetMinMinor?: bigint | number | string | null;
    budgetMaxMinor?: bigint | number | string | null;
    currency?: string;
    skills?: string[];
    category?: { name: string; slug: string } | null;
    owner?: { name: string; username?: string; profile?: { trustScore?: number } | null; trustScore?: number } | null;
  };
};

export function OpportunityCard({ opportunity }: OpportunityCardProps) {
  const trustScore = opportunity.owner?.profile?.trustScore ?? opportunity.owner?.trustScore;
  const ownerInitials = (opportunity.owner?.name ?? "perX")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <Card className="grid gap-4 overflow-hidden p-0">
      <div className="prex-opportunity-band relative min-h-28 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="grid h-12 w-12 place-items-center rounded-[var(--px-radius-sm)] bg-white/15 text-sm font-black ring-1 ring-white/20">
            {ownerInitials}
          </div>
          <button
            aria-label={`Save ${opportunity.title}`}
            className="grid h-10 w-10 place-items-center rounded-full bg-white/15 text-white ring-1 ring-white/20 transition hover:bg-white/25"
            type="button"
          >
            <Bookmark aria-hidden size={17} />
          </button>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-white/16 px-3 py-1 text-xs font-semibold capitalize text-white ring-1 ring-white/20">
            {opportunity.type.replaceAll("_", " ").toLowerCase()}
          </span>
          {opportunity.category ? (
            <span className="rounded-full bg-white/16 px-3 py-1 text-xs font-semibold text-white ring-1 ring-white/20">{opportunity.category.name}</span>
          ) : null}
        </div>
      </div>
      <div className="grid gap-4 p-5">
        <div className="flex flex-wrap items-center gap-2">
          {trustScore ? (
            <Badge className="border-green-200 bg-green-50 text-green-800">
              <ShieldCheck aria-hidden className="mr-1" size={13} />
              Trust {trustScore}
            </Badge>
          ) : null}
          <Badge>
            <MapPin aria-hidden className="mr-1" size={13} />
            {opportunity.remote ? "Remote" : opportunity.location || "Location set by owner"}
          </Badge>
        </div>
        <div>
          <Link className="text-xl font-bold text-[color:var(--px-text)] hover:text-[color:var(--px-primary)]" href={`/opportunities/${opportunity.slug}`}>
            {opportunity.title}
          </Link>
          <p className="mt-2 text-sm leading-6 text-[color:var(--px-text-muted)]">{opportunity.summary}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(opportunity.skills ?? []).slice(0, 5).map((skill) => (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-[color:var(--px-text-muted)]" key={skill}>
              {skill}
            </span>
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[color:var(--px-border)] pt-4 text-sm">
          <span className="font-bold text-[color:var(--px-text)]">
            {formatBudgetRange(opportunity.budgetMinMinor, opportunity.budgetMaxMinor, opportunity.currency ?? "NGN")}
          </span>
          <Link className="text-sm font-semibold text-[color:var(--px-primary)] hover:text-[color:var(--px-primary-strong)]" href={`/opportunities/${opportunity.slug}`}>
            View details
          </Link>
        </div>
      </div>
    </Card>
  );
}
