import Link from "next/link";
import Image from "next/image";
import {
  Bookmark,
  CalendarDays,
  ChevronRight,
  MapPin,
  ShieldCheck,
} from "lucide-react";

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
    publishedAt?: Date | string | null;
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
  const ownerName = opportunity.owner?.name ?? "perX member";
  const ownerInitials = (opportunity.owner?.name ?? "perX")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <Card className="relative overflow-hidden p-0 transition hover:border-[color:var(--px-border-strong)] hover:shadow-[var(--px-shadow-strong)]">
      <button
        aria-label={`Save ${opportunity.title}`}
        className="absolute right-4 top-4 z-20 grid h-10 w-10 place-items-center rounded-full border border-[color:var(--px-border)] bg-[color:var(--px-surface)] text-[color:var(--px-text-muted)] shadow-sm transition hover:bg-[color:var(--px-surface-soft)] hover:text-[color:var(--px-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)]"
        type="button"
      >
        <Bookmark aria-hidden size={17} />
      </button>
      <Link
        className="group grid focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[color:var(--px-focus)]"
        href={href ?? `/opportunities/${opportunity.slug}`}
      >
        <div className="grid gap-4 p-5 pr-16">
          <div className="flex items-start gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[color:var(--px-primary)] text-sm font-black text-white">
              {ownerInitials}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-black text-[color:var(--px-text)]">
                {ownerName}
              </p>
              <p className="mt-0.5 truncate text-xs font-semibold text-[color:var(--px-text-muted)]">
                {opportunity.category?.name ?? "Opportunity owner"}
              </p>
            </div>
          </div>
        </div>

        <div className="relative mx-5 h-32 overflow-hidden rounded-[14px] bg-[color:var(--px-muted)]">
          <Image
            src={imageSrc}
            alt={imageAlt}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
          />
        </div>

        <div className="grid gap-4 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="capitalize">
              {opportunity.type.replaceAll("_", " ").toLowerCase()}
            </Badge>
            {trustScore ? (
              <Badge className="border-green-200 bg-green-50 text-green-800">
                <ShieldCheck aria-hidden className="mr-1" size={13} />
                Trust {trustScore}
              </Badge>
            ) : null}
          </div>

          <div>
            <h2 className="text-lg font-black leading-snug text-[color:var(--px-text)] transition-colors group-hover:text-[color:var(--px-primary)]">
              {opportunity.title}
            </h2>
            <p className="mt-2 line-clamp-3 text-sm leading-6 text-[color:var(--px-text-muted)]">
              {opportunity.summary}
            </p>
          </div>

          <div className="grid gap-2 rounded-[var(--px-radius-sm)] bg-[color:var(--px-surface-soft)] p-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="font-semibold text-[color:var(--px-text-muted)]">
                Compensation
              </span>
              <span className="text-right font-black text-[color:var(--px-text)]">
                {formatBudgetRange(
                  opportunity.budgetMinMinor,
                  opportunity.budgetMaxMinor,
                  opportunity.currency ?? "NGN",
                )}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-[color:var(--px-text-muted)]">
              <span className="inline-flex items-center gap-1">
                <MapPin aria-hidden size={13} />
                {opportunity.remote
                  ? "Remote"
                  : opportunity.location || "Location set by owner"}
              </span>
              <span className="inline-flex items-center gap-1">
                <CalendarDays aria-hidden size={13} />
                {formatPostedAt(opportunity.publishedAt)}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {(opportunity.skills ?? []).slice(0, 4).map((skill) => (
              <span
                className="rounded-full bg-[color:var(--px-muted)] px-3 py-1 text-xs font-semibold text-[color:var(--px-text-muted)]"
                key={skill}
              >
                {skill}
              </span>
            ))}
          </div>

          <div className="flex items-center justify-between border-t border-[color:var(--px-border)] pt-4 text-sm">
            <span className="font-semibold text-[color:var(--px-text-muted)]">
              Enquiry first
            </span>
            <span className="inline-flex items-center font-black text-[color:var(--px-primary)]">
              View details
              <ChevronRight aria-hidden className="ml-1" size={16} />
            </span>
          </div>
        </div>
      </Link>
    </Card>
  );
}

function formatPostedAt(value: Date | string | null | undefined) {
  if (!value) return "Recently listed";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently listed";

  const diffMs = Date.now() - date.getTime();
  const diffDays = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));

  if (diffDays < 1) return "Today";
  if (diffDays === 1) return "1 day ago";
  if (diffDays < 30) return `${diffDays} days ago`;

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
