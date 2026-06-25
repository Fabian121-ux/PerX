import Link from "next/link";
import Image from "next/image";
import { Bookmark, MapPin, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { getTemporaryOpportunityImage } from "@/lib/data/temporary-images";
import { formatBudgetRange } from "@/lib/money";

type OpportunityCardProps = {
  href?: string;
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
    imageAlt?: string;
    imageUrl?: string;
    skills?: string[];
    category?: { name: string; slug: string } | null;
    owner?: { name: string; username?: string; profile?: { trustScore?: number } | null; trustScore?: number } | null;
  };
};

export function OpportunityCard({ href, opportunity }: OpportunityCardProps) {
  const trustScore = opportunity.owner?.profile?.trustScore ?? opportunity.owner?.trustScore;
  const temporaryImage = getTemporaryOpportunityImage(opportunity.slug);
  const imageSrc = opportunity.imageUrl ?? temporaryImage.src;
  const imageAlt = opportunity.imageAlt ?? temporaryImage.alt;
  const ownerInitials = (opportunity.owner?.name ?? "perX")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <Card className="relative overflow-hidden p-0">
      <button
        aria-label={`Save ${opportunity.title}`}
        className="absolute right-5 top-5 z-20 grid h-10 w-10 place-items-center rounded-full bg-black/45 text-white ring-1 ring-white/20 transition hover:bg-black/65 focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)]"
        type="button"
      >
        <Bookmark aria-hidden size={17} />
      </button>
      <Link className="group grid gap-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[color:var(--px-focus)]" href={href ?? `/opportunities/${opportunity.slug}`}>
        <div className="relative min-h-36 overflow-hidden p-5 text-white">
          <Image
            src={imageSrc}
            alt={imageAlt}
            fill
            className="object-cover transition-transform duration-500 hover:scale-105"
            sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-black/78 via-black/52 to-black/25" />
          <div className="relative z-10 grid h-12 w-12 place-items-center rounded-[var(--px-radius-sm)] bg-white/15 text-sm font-black ring-1 ring-white/20">
            {ownerInitials}
          </div>
          <div className="relative z-10 mt-6 flex flex-wrap items-center gap-2 pr-12">
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
          <h2 className="text-xl font-bold text-[color:var(--px-text)] transition-colors group-hover:text-[color:var(--px-primary)]">{opportunity.title}</h2>
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
          <span className="text-sm font-semibold text-[color:var(--px-primary)]">
            View details
          </span>
        </div>
      </div>
      </Link>
    </Card>
  );
}
