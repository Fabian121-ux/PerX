import Link from "next/link";
import {
  Bookmark,
  ClipboardList,
  FileText,
  Handshake,
  Inbox,
  Send,
  type LucideIcon,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import type { ProfileActivity } from "@/lib/data/profile-activity";

type ActivityTile = {
  href: string;
  icon: LucideIcon;
  label: string;
  value: number;
};

/**
 * The viewer's own activity counts, shown inside Profile.
 *
 * This replaces the separate `/app/dashboard` route: personal activity
 * belongs to the user's own hub rather than competing with Profile as a second
 * primary destination.
 *
 * Every tile is a link, so a count is never a dead end - the number always
 * leads to the records it counts.
 */
export function ProfileActivitySummary({
  activity,
}: {
  activity: ProfileActivity;
}) {
  const tiles: ActivityTile[] = [
    {
      href: "/app/deals",
      icon: Handshake,
      label: "Active agreements",
      value: activity.activeAgreements,
    },
    {
      href: "/app/deals",
      icon: Handshake,
      label: "Completed agreements",
      value: activity.completedAgreements,
    },
    {
      href: "/app/proposals/sent",
      icon: Send,
      label: "Proposals sent",
      value: activity.proposalsSent,
    },
    {
      href: "/app/proposals/received",
      icon: Inbox,
      label: "Proposals received",
      value: activity.proposalsReceived,
    },
    {
      href: "/app/manage?status=PUBLISHED",
      icon: ClipboardList,
      label: "Published posts",
      value: activity.published,
    },
    {
      href: "/app/manage?status=DRAFT",
      icon: FileText,
      label: "Drafts",
      value: activity.drafts,
    },
    {
      href: "/app/saved",
      icon: Bookmark,
      label: "Saved items",
      value: activity.savedItems,
    },
  ];

  return (
    <Card>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-bold text-[color:var(--px-text)]">
          Your activity
        </h2>
        {/*
          Counts are optional data. When an aggregate fails we say so rather
          than silently rendering a zero, which would read as "you have
          nothing" instead of "we could not load this".
        */}
        {activity.degraded ? (
          <p
            className="text-xs font-semibold text-[color:var(--px-text-muted)]"
            role="status"
          >
            Some counts could not be loaded and may be out of date.
          </p>
        ) : null}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {tiles.map((tile) => (
          <Link
            className="group flex items-center gap-3 rounded-[var(--px-radius-sm)] border border-[color:var(--px-border)] bg-[color:var(--px-surface-soft)] p-3 transition hover:border-[color:var(--px-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)]"
            href={tile.href}
            key={tile.label}
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[var(--px-radius-sm)] bg-[color:var(--px-muted)] text-[color:var(--px-text-muted)] transition group-hover:bg-[color:var(--px-primary-soft)] group-hover:text-[color:var(--px-primary)]">
              <tile.icon aria-hidden size={18} />
            </span>
            <span className="min-w-0">
              <span className="block text-xl font-black leading-tight text-[color:var(--px-text)]">
                {tile.value}
              </span>
              <span className="block truncate text-xs font-semibold text-[color:var(--px-text-muted)]">
                {tile.label}
              </span>
            </span>
          </Link>
        ))}
      </div>
    </Card>
  );
}
