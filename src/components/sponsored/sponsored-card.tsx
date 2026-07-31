"use client";

import { ArrowRight, X } from "lucide-react";
import { useState } from "react";

import {
  dismissSponsored,
  isSponsoredDismissed,
} from "@/lib/sponsored/dismissal";
import type { PublicSponsoredContent } from "@/lib/data/sponsored-content";
import { cn } from "@/lib/utils";

export type SponsoredCardProps = {
  content: PublicSponsoredContent;
  className?: string;
};

export function SponsoredCard({ content, className }: SponsoredCardProps) {
  const { id, brandName, message, ctaLabel, ctaHref, imageUrl } = content;
  const [dismissed, setDismissed] = useState(() =>
    typeof window !== "undefined" ? isSponsoredDismissed(id) : false,
  );

  if (dismissed) return null;

  const handleDismiss = () => {
    dismissSponsored(id);
    setDismissed(true);
  };

  return (
    <aside
      aria-label="Sponsored content"
      className={cn(
        "sponsored-enter perx-card relative flex flex-col gap-3 overflow-hidden p-4 sm:flex-row sm:items-center",
        className,
      )}
      data-testid="sponsored-card"
    >
      <span
        className="absolute left-3 top-2.5 inline-flex items-center rounded-full bg-[color:var(--px-primary-soft)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[color:var(--px-primary)] ring-1 ring-[color:var(--px-primary)]/20"
        data-testid="sponsored-label"
      >
        Sponsored
      </span>

      <button
        aria-label={`Dismiss sponsored content from ${brandName}`}
        className="absolute right-2.5 top-2 grid h-7 w-7 place-items-center rounded-full text-[color:var(--px-text-muted)] transition hover:bg-[color:var(--px-hover)] hover:text-[color:var(--px-text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)]"
        onClick={handleDismiss}
        type="button"
      >
        <X aria-hidden size={14} />
      </button>

      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt={`${brandName} sponsor logo`}
          className="ml-0 mt-5 h-14 w-14 shrink-0 rounded-[var(--px-radius-sm)] object-cover sm:mt-0"
          loading="lazy"
          src={imageUrl}
        />
      ) : null}

      <div className="mt-5 min-w-0 flex-1 sm:mt-0">
        <p className="text-sm font-bold text-[color:var(--px-text)]">
          {brandName}
        </p>
        <p className="mt-1 line-clamp-2 text-sm leading-6 text-[color:var(--px-text-muted)]">
          {message}
        </p>
      </div>

      <a
        className="perx-btn-secondary inline-flex shrink-0 items-center justify-center gap-1.5 self-start whitespace-nowrap rounded-[var(--px-radius-sm)] px-3.5 py-2 text-xs font-semibold sm:self-center"
        href={ctaHref}
        rel="sponsored"
      >
        {ctaLabel}
        <ArrowRight aria-hidden size={14} />
      </a>
    </aside>
  );
}