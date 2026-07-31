"use client";

import {
  Bell,
  Menu,
  MessageSquare,
  Newspaper,
  Search,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";

import { BrandLogo } from "@/components/brand-logo";
import { FeatureDirectory } from "@/components/navigation/feature-directory";
import { SecondaryMenu } from "@/components/navigation/secondary-menu";
import type { CurrentUser } from "@/lib/auth/session";
import type { UnreadCounts } from "@/lib/data/unread-counts";
import { getAppRoute } from "@/lib/navigation/app-routes";
import {
  formatNavigationBadge,
  shouldShowNavigationDot,
} from "@/lib/navigation/navigation-state";
import { AccountMenu } from "./account-menu";
import { CreateMenu } from "./create-menu";
import { ThemeToggle } from "./theme-toggle";

function IconBadge({ count, label }: { count: number; label: string }) {
  const display = formatNavigationBadge(count);
  if (!display) return null;

  return (
    <span
      aria-label={`${display} unread ${label}`}
      className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-[color:var(--px-warning)] px-1 text-[10px] font-black leading-none text-white ring-2 ring-[color:var(--px-surface)]"
    >
      {display}
    </span>
  );
}

function IconDot({ show }: { show: boolean }) {
  if (!show) return null;

  return (
    <span
      aria-hidden
      className="absolute right-0 top-0 h-2.5 w-2.5 rounded-full bg-[color:var(--px-warning)] ring-2 ring-[color:var(--px-surface)]"
    />
  );
}

export function DashboardTopbar({
  user,
  unreadCounts,
  featureDirectory = false,
  previewMode = false,
  secondaryMenu = false,
  onMenuClick,
}: {
  user: CurrentUser;
  unreadCounts: UnreadCounts;
  featureDirectory?: boolean;
  previewMode?: boolean;
  secondaryMenu?: boolean;
  onMenuClick?: () => void;
}) {
  const homeHref = previewMode ? "/preview" : "/app";
  const searchHref = previewMode ? "/preview/discover" : getAppRoute("search");
  const messagesHref = previewMode ? "/preview/messages" : "/app/messages";
  const activityHref = previewMode
    ? "/preview/notifications"
    : "/app/notifications";
  const newsHref = previewMode ? "/preview/notifications" : getAppRoute("news");
  const trustHref = previewMode ? "/preview" : "/app/trust";
  const unreadConversations = formatNavigationBadge(
    unreadCounts.unreadConversations,
  );
  const unreadActivity = formatNavigationBadge(unreadCounts.generalActivity);
  const hasUnreadNews = shouldShowNavigationDot(unreadCounts.unreadNews);

  return (
    <header className="dashboard-topbar sticky top-0 z-40 flex h-16 w-full shrink-0 items-center justify-between border-b border-[color:var(--px-border)] px-3 shadow-[0_10px_30px_rgba(15,23,42,0.08)] backdrop-blur sm:px-4 lg:px-8">
      <div className="flex min-w-0 flex-1 items-center gap-3 lg:gap-6">
        <div className="flex min-w-0 items-center lg:hidden">
          {featureDirectory ? (
            <FeatureDirectory userRoles={user.roles}>
              <button
                aria-label="Open PerX feature directory"
                className="flex h-11 min-w-11 items-center rounded-xl pr-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
                type="button"
              >
                <BrandLogo
                  className="h-8 max-w-[116px]"
                  dark
                  decorative
                  priority
                />
              </button>
            </FeatureDirectory>
          ) : (
            <Link
              aria-label="PerX Home"
              className="flex h-11 min-w-11 items-center rounded-xl pr-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
              href={homeHref}
            >
              <BrandLogo className="h-8 max-w-[116px]" dark priority />
            </Link>
          )}
        </div>

        {previewMode ? (
          <span className="hidden rounded-full bg-[color:var(--px-primary-soft)] px-2.5 py-0.5 text-xs font-bold tracking-wide text-[color:var(--px-primary)] ring-1 ring-[color:var(--px-primary)]/30 lg:inline-flex">
            Preview Mode
          </span>
        ) : null}

        <form
          action={searchHref}
          className="hidden max-w-lg flex-1 items-center gap-2 rounded-[var(--px-radius-sm)] border border-[color:var(--px-border)] bg-[color:var(--px-muted)] px-3 py-2 transition-colors focus-within:border-[color:var(--px-primary)] focus-within:ring-2 focus-within:ring-[color:var(--px-focus)]/25 hover:border-[color:var(--px-primary)] lg:flex"
        >
          <Search
            aria-hidden
            className="text-[color:var(--px-text-muted)]"
            size={18}
          />
          <label className="sr-only" htmlFor="workspace-search">
            Search PerX
          </label>
          <input
            className="min-w-0 flex-1 bg-transparent text-sm text-[color:var(--px-text)] outline-none placeholder:text-[color:var(--px-text-muted)]"
            id="workspace-search"
            name="q"
            placeholder="Search opportunities, people and businesses..."
          />
        </form>
      </div>

      <div className="flex shrink-0 items-center">
        <div className="flex items-center gap-1.5 lg:hidden">
          <Link
            aria-label="Search PerX"
            className="grid h-11 w-11 place-items-center rounded-xl border border-[color:var(--px-border)] bg-[color:var(--px-surface)] text-[color:var(--px-text)] transition hover:bg-[color:var(--px-surface-soft)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)]"
            href={searchHref}
          >
            <Search aria-hidden size={21} />
          </Link>

          <Link
            aria-label={hasUnreadNews ? "News, unread" : "News"}
            className="relative grid h-11 w-11 place-items-center rounded-xl border border-[color:var(--px-border)] bg-[color:var(--px-surface)] text-[color:var(--px-text)] transition hover:bg-[color:var(--px-surface-soft)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)]"
            href={newsHref}
          >
            <Newspaper aria-hidden size={20} />
            <IconDot show={hasUnreadNews} />
          </Link>

          {secondaryMenu ? (
            <SecondaryMenu unreadCounts={unreadCounts} user={user} />
          ) : (
            <button
              aria-label="Open navigation menu"
              className="grid h-11 w-11 place-items-center rounded-xl border border-[color:var(--px-border)] bg-[color:var(--px-surface)] text-[color:var(--px-text)] transition hover:bg-[color:var(--px-surface-soft)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)]"
              onClick={onMenuClick}
              type="button"
            >
              <Menu aria-hidden size={22} />
            </button>
          )}
        </div>

        <div className="hidden items-center gap-2 lg:flex">
          <CreateMenu previewMode={previewMode} />
          <div className="mx-2 h-6 w-px bg-[color:var(--px-border)]" />
          <ThemeToggle />

          <Link
            aria-label="Trust dashboard"
            className="grid h-11 w-11 place-items-center rounded-full text-[color:var(--px-text-muted)] transition-colors hover:bg-[color:var(--px-surface-soft)] hover:text-[color:var(--px-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)]"
            href={trustHref}
            title="Trust dashboard"
          >
            <ShieldCheck aria-hidden size={20} />
          </Link>

          <Link
            aria-label={
              hasUnreadNews ? "News, unread" : "News"
            }
            className="relative grid h-11 w-11 place-items-center rounded-full text-[color:var(--px-text-muted)] transition-colors hover:bg-[color:var(--px-surface-soft)] hover:text-[color:var(--px-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)]"
            href={newsHref}
            title="News"
          >
            <Newspaper aria-hidden size={20} />
            <IconDot show={hasUnreadNews} />
          </Link>

          <Link
            aria-label={
              unreadActivity
                ? `${unreadActivity} unread activity updates`
                : "Activity"
            }
            className="relative grid h-11 w-11 place-items-center rounded-full text-[color:var(--px-text-muted)] transition-colors hover:bg-[color:var(--px-surface-soft)] hover:text-[color:var(--px-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)]"
            href={activityHref}
            title="Activity"
          >
            <Bell aria-hidden size={20} />
            <IconBadge
              count={unreadCounts.generalActivity}
              label="activity updates"
            />
          </Link>

          <Link
            aria-label={
              unreadConversations
                ? `${unreadConversations} unread conversations`
                : "Messages"
            }
            className="relative grid h-11 w-11 place-items-center rounded-full text-[color:var(--px-text-muted)] transition-colors hover:bg-[color:var(--px-surface-soft)] hover:text-[color:var(--px-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)]"
            href={messagesHref}
            title="Messages"
          >
            <MessageSquare aria-hidden size={20} />
            <IconBadge
              count={unreadCounts.unreadConversations}
              label="conversations"
            />
          </Link>

          <AccountMenu previewMode={previewMode} user={user} />
        </div>
      </div>
    </header>
  );
}
