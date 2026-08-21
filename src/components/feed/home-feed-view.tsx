import {
  Bookmark,
  MessageSquare,
  PlusCircle,
  UsersRound,
} from "lucide-react";
import Link from "next/link";

import type { ReactNode } from "react";

import { FeedComposerEntry } from "@/components/feed/feed-composer-entry";
import { Card } from "@/components/ui/card";

/**
 * Home layout.
 *
 * Two columns on desktop: a reading-width feed and a secondary rail. The feed
 * column is capped rather than stretched - a card spanning a 2560px monitor is
 * unreadable, and the cap also lets the media `sizes` hint stay accurate.
 *
 * On mobile the rail collapses below the feed, so posts are the first thing on
 * screen at every breakpoint.
 */
export function HomeFeedView({
  canCreate,
  connectionRequestsCount,
  feed,
  profileCompleteness,
  unreadConversationsCount,
  user,
}: {
  canCreate: boolean;
  connectionRequestsCount: number;
  /** Streams behind a Suspense boundary owned by the page. */
  feed: ReactNode;
  profileCompleteness: number;
  unreadConversationsCount: number;
  user: { avatarUrl: string | null; id: string; name: string };
}) {
  return (
    <div className="mx-auto grid w-full max-w-[1180px] gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="mx-auto flex w-full min-w-0 max-w-[640px] flex-col gap-4 lg:mx-0">
        <h1 className="sr-only">Home</h1>

        {canCreate ? (
          <FeedComposerEntry avatarUrl={user.avatarUrl} name={user.name} />
        ) : null}

        {feed}
      </div>

      {/*
        Sticky only at lg+, where there is room beside the feed. Below that it
        is ordinary flow content underneath the posts.
      */}
      <aside className="flex flex-col gap-4 lg:sticky lg:top-6 lg:self-start">
        {profileCompleteness < 100 ? (
          <ProfileCompletionCard value={profileCompleteness} />
        ) : null}

        <RailCard
          count={unreadConversationsCount}
          href="/app/messages"
          icon={<MessageSquare aria-hidden size={18} />}
          label="Messages"
          title="Unread conversations"
        />
        <RailCard
          count={connectionRequestsCount}
          href="/app/connections/requests"
          icon={<UsersRound aria-hidden size={18} />}
          label="Requests"
          title="Connection requests"
        />
        <RailCard
          href="/app/saved"
          icon={<Bookmark aria-hidden size={18} />}
          label="Saved"
          title="Saved items"
        />
        {canCreate ? (
          <RailCard
            href="/app/manage"
            icon={<PlusCircle aria-hidden size={18} />}
            label="Manage"
            title="Your posts"
          />
        ) : null}
      </aside>
    </div>
  );
}

function RailCard({
  count,
  href,
  icon,
  label,
  title,
}: {
  count?: number;
  href: string;
  icon: React.ReactNode;
  label: string;
  title: string;
}) {
  return (
    <Link
      className="flex min-h-11 items-center gap-3 rounded-[var(--px-radius)] border border-[color:var(--px-border)] bg-[color:var(--px-surface)] px-4 py-3 transition hover:border-[color:var(--px-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)]"
      href={href}
    >
      <span className="perx-soft-tile grid h-10 w-10 shrink-0 place-items-center rounded-[var(--px-radius-sm)]">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-black text-[color:var(--px-text)]">
          {title}
        </span>
        <span className="block text-xs text-[color:var(--px-text-muted)]">
          {label}
        </span>
      </span>
      {count ? (
        <span className="shrink-0 rounded-full bg-[color:var(--px-primary)] px-2 py-0.5 text-xs font-black text-white">
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
    </Link>
  );
}

function ProfileCompletionCard({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(value, 100));

  return (
    <Card>
      <h2 className="font-black text-[color:var(--px-text)]">
        Profile completion
      </h2>
      <p className="mt-1 text-sm leading-6 text-[color:var(--px-text-muted)]">
        {clamped >= 80
          ? "Your profile is ready for stronger discovery."
          : "Add your photo, location, introduction and skills."}
      </p>
      <div
        aria-label="Profile completeness"
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={clamped}
        className="mt-4 h-2 overflow-hidden rounded-full bg-[color:var(--px-muted)]"
        role="progressbar"
      >
        <div
          className="h-full rounded-full bg-[color:var(--px-primary)]"
          style={{ width: `${clamped}%` }}
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
