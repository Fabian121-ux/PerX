"use client";

import { Bell, MessageSquare, Search, ShieldCheck } from "lucide-react";
import Link from "next/link";

import type { CurrentUser } from "@/lib/auth/session";
import { CreateMenu } from "./create-menu";
import { AccountMenu } from "./account-menu";
import { ThemeToggle } from "./theme-toggle";
import { FeatureStatusDialog } from "@/components/shared/feature-status-dialog";
import { BrandSymbol } from "@/components/brand-logo";

export function DashboardTopbar({
  user,
  previewMode = false,
  onMenuClick,
}: {
  user: CurrentUser;
  previewMode?: boolean;
  onMenuClick?: () => void;
}) {
  const discoverHref = previewMode ? "/preview/discover" : "/app/discover";

  return (
    <header className="dashboard-topbar sticky top-0 z-40 flex h-16 w-full shrink-0 items-center justify-between border-b border-[color:var(--px-border)] px-3 shadow-[0_10px_30px_rgba(15,23,42,0.08)] backdrop-blur sm:px-6 lg:px-8">
      <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-4 lg:gap-6">
        <button
          onClick={onMenuClick}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white transition-colors hover:bg-[color:var(--px-surface-soft)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)] lg:hidden"
          aria-label="Open navigation menu"
          type="button"
        >
          <BrandSymbol className="h-7 w-10" dark />
        </button>

        {previewMode ? (
          <span className="hidden rounded-full bg-[color:var(--px-primary-soft)] px-2.5 py-0.5 text-xs font-bold tracking-wide text-[color:var(--px-primary)] ring-1 ring-[color:var(--px-primary)]/30 lg:inline-flex">
            Preview Mode
          </span>
        ) : null}

        <form
          action={discoverHref}
          className="hidden max-w-lg flex-1 items-center gap-2 rounded-[var(--px-radius-sm)] border border-[color:var(--px-border)] bg-[color:var(--px-muted)] px-3 py-2 transition-colors focus-within:border-[color:var(--px-primary)] focus-within:ring-2 focus-within:ring-[color:var(--px-focus)]/25 hover:border-[color:var(--px-primary)] sm:flex"
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

      <div className="flex shrink-0 items-center gap-1.5 sm:gap-5">
        <div className="hidden sm:block">
          <CreateMenu previewMode={previewMode} />
        </div>

        <div className="hidden h-6 w-px bg-[color:var(--px-border)] sm:block" />

        <div className="flex items-center gap-1 sm:gap-2">
          <div className="hidden sm:block">
            <ThemeToggle />
          </div>

          <Link
            className="flex h-11 w-11 items-center justify-center rounded-full text-[color:var(--px-text-muted)] transition-colors hover:bg-[color:var(--px-surface-soft)] hover:text-[color:var(--px-primary)] focus:bg-[color:var(--px-surface-soft)] focus:text-[color:var(--px-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)] sm:hidden"
            aria-label="Search"
            href={discoverHref}
          >
            <Search size={20} />
          </Link>

          <FeatureStatusDialog featureName="Trust Dashboard">
            <button
              className="hidden h-9 w-9 items-center justify-center rounded-full text-[color:var(--px-text-muted)] transition-colors hover:bg-[color:var(--px-surface-soft)] hover:text-[color:var(--px-primary)] focus:bg-[color:var(--px-surface-soft)] focus:text-[color:var(--px-primary)] focus:outline-none sm:flex"
              aria-label="Trust Dashboard"
            >
              <ShieldCheck size={20} />
            </button>
          </FeatureStatusDialog>

          <FeatureStatusDialog featureName="Notifications">
            <button
              className="relative flex h-11 w-11 items-center justify-center rounded-full text-[color:var(--px-text-muted)] transition-colors hover:bg-[color:var(--px-surface-soft)] hover:text-[color:var(--px-primary)] focus:bg-[color:var(--px-surface-soft)] focus:text-[color:var(--px-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)] sm:h-9 sm:w-9"
              aria-label="Notifications"
            >
              <Bell size={20} />
              <span className="absolute right-1.5 top-1.5 flex h-2.5 w-2.5 rounded-full bg-[color:var(--px-gold)] ring-2 ring-[color:var(--px-surface)]" />
            </button>
          </FeatureStatusDialog>

          <FeatureStatusDialog featureName="Messages">
            <button
              className="relative hidden h-9 w-9 items-center justify-center rounded-full text-[color:var(--px-text-muted)] transition-colors hover:bg-[color:var(--px-surface-soft)] hover:text-[color:var(--px-primary)] focus:bg-[color:var(--px-surface-soft)] focus:text-[color:var(--px-primary)] focus:outline-none sm:flex"
              aria-label="Messages"
            >
              <MessageSquare size={20} />
              <span className="absolute right-1.5 top-1.5 flex h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-[color:var(--px-surface)]" />
            </button>
          </FeatureStatusDialog>
        </div>

        <AccountMenu user={user} previewMode={previewMode} />
      </div>
    </header>
  );
}
