"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { ArrowRight, Search, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState, type ReactElement } from "react";

import {
  featureGroups,
  getFeatureById,
  searchFeatures,
} from "@/lib/navigation/feature-registry";
import { isNavigationItemActive } from "@/lib/navigation/navigation-state";

export function FeatureDirectory({
  children,
  closeLabel = "Close feature directory",
  description = "Search all available app destinations from one place.",
  title = "Explore PerX",
  userRoles,
}: {
  children: ReactElement;
  closeLabel?: string;
  description?: string;
  title?: string;
  userRoles?: readonly string[];
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();
  const home = getFeatureById("home");
  const HomeIcon = home.icon;
  const matches = searchFeatures(query, { roles: userRoles });
  const homeMatches = matches.some((feature) => feature.id === home.id);
  const results = matches.filter((feature) => feature.id !== home.id);

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) setQuery("");
      }}
    >
      <Dialog.Trigger asChild>{children}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[70] bg-[color:var(--px-overlay)] backdrop-blur-[2px]" />
        <Dialog.Content
          data-app-navigation="true"
          className="fixed inset-x-0 bottom-0 z-[71] flex max-h-[94dvh] flex-col overflow-hidden rounded-t-[28px] border border-[color:var(--px-border)] bg-[color:var(--px-surface)] shadow-[var(--px-shadow-strong)] focus:outline-none sm:bottom-auto sm:left-1/2 sm:right-auto sm:top-1/2 sm:w-[min(960px,calc(100vw-2rem))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[28px]"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            closeButtonRef.current?.focus();
          }}
        >
          <div className="flex items-start justify-between gap-4 border-b border-[color:var(--px-border)] px-4 py-4 sm:px-6 sm:py-5">
            <div className="min-w-0">
              <Dialog.Title className="text-xl font-black text-[color:var(--px-text)] sm:text-2xl">
                {title}
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm leading-5 text-[color:var(--px-text-muted)]">
                {description}
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                aria-label={closeLabel}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-[color:var(--px-text-muted)] transition hover:bg-[color:var(--px-surface-soft)] hover:text-[color:var(--px-text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)]"
                ref={closeButtonRef}
                type="button"
              >
                <X aria-hidden size={20} />
              </button>
            </Dialog.Close>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 sm:px-6 sm:pb-6">
            <Dialog.Close asChild>
              <Link
                className="group flex min-h-20 items-center gap-4 rounded-2xl bg-[linear-gradient(135deg,var(--px-navy),var(--px-navy-3))] p-4 text-white shadow-[0_16px_36px_rgba(6,25,54,0.24)] transition hover:-translate-y-0.5 hover:shadow-[0_20px_42px_rgba(6,25,54,0.3)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--px-surface)] sm:p-5"
                aria-current={
                  isNavigationItemActive(pathname, home.href, {
                    aliases: home.activePaths,
                    exact: home.exact,
                  })
                    ? "page"
                    : undefined
                }
                href={home.href}
              >
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/12 ring-1 ring-white/15">
                  <HomeIcon aria-hidden size={24} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-black uppercase tracking-[0.14em] text-white/65">
                    Start here
                  </span>
                  <span className="mt-1 block text-lg font-black">
                    Go to Home
                  </span>
                  <span className="mt-0.5 block text-sm text-white/72">
                    {home.description}
                  </span>
                </span>
                <ArrowRight
                  aria-hidden
                  className="shrink-0 transition-transform group-hover:translate-x-1"
                  size={21}
                />
              </Link>
            </Dialog.Close>

            <div className="relative mt-4">
              <Search
                aria-hidden
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[color:var(--px-text-muted)]"
                size={19}
              />
              <label className="sr-only" htmlFor="feature-directory-search">
                Search PerX features
              </label>
              <input
                className="h-12 w-full rounded-xl border border-[color:var(--px-border)] bg-[color:var(--px-muted)] pl-11 pr-12 text-sm text-[color:var(--px-text)] outline-none placeholder:text-[color:var(--px-text-muted)] focus:border-[color:var(--px-primary)] focus:ring-2 focus:ring-[color:var(--px-focus)]/25"
                id="feature-directory-search"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search features and destinations"
                type="search"
                value={query}
              />
              {query ? (
                <button
                  aria-label="Clear feature search"
                  className="absolute right-0 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-xl text-[color:var(--px-text-muted)] hover:text-[color:var(--px-text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)]"
                  onClick={() => setQuery("")}
                  type="button"
                >
                  <X aria-hidden size={17} />
                </button>
              ) : null}
            </div>

            <p
              aria-live="polite"
              className="mt-3 text-xs font-semibold text-[color:var(--px-text-muted)]"
            >
              {results.length + (homeMatches ? 1 : 0)} matching destinations
            </p>

            <div className="mt-4 grid gap-6">
              {featureGroups.map((group) => {
                const groupFeatures = results.filter(
                  (feature) => feature.group === group.id,
                );

                if (!groupFeatures.length) return null;

                return (
                  <section
                    aria-labelledby={`feature-group-${group.id}`}
                    key={group.id}
                  >
                    <h2
                      className="mb-2 text-xs font-black uppercase tracking-[0.12em] text-[color:var(--px-text-muted)]"
                      id={`feature-group-${group.id}`}
                    >
                      {group.label}
                    </h2>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {groupFeatures.map((feature) => {
                        const Icon = feature.icon;
                        const active = isNavigationItemActive(
                          pathname,
                          feature.href,
                          {
                            aliases: feature.activePaths,
                            exact: feature.exact,
                          },
                        );

                        return (
                          <Dialog.Close asChild key={feature.id}>
                            <Link
                              className="group flex min-h-[88px] items-start gap-3 rounded-xl border border-[color:var(--px-border)] bg-[color:var(--px-surface-elevated)] p-3 text-left transition hover:border-[color:var(--px-primary)] hover:bg-[color:var(--px-hover)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)]"
                              aria-current={active ? "page" : undefined}
                              href={feature.href}
                            >
                              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[color:var(--px-primary-soft)] text-[color:var(--px-primary)]">
                                <Icon aria-hidden size={19} />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="flex flex-wrap items-center gap-1.5">
                                  <span className="text-sm font-black text-[color:var(--px-text)] group-hover:text-[color:var(--px-primary)]">
                                    {feature.label}
                                  </span>
                                  {feature.status ? (
                                    <span
                                      className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wide ${
                                        feature.status.kind === "simulated"
                                          ? "bg-amber-100 text-amber-800"
                                          : "bg-[color:var(--px-primary-soft)] text-[color:var(--px-primary)]"
                                      }`}
                                    >
                                      {feature.status.label}
                                    </span>
                                  ) : null}
                                </span>
                                <span className="mt-1 block text-xs leading-4 text-[color:var(--px-text-muted)]">
                                  {feature.description}
                                </span>
                              </span>
                            </Link>
                          </Dialog.Close>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>

            {!results.length && query && !homeMatches ? (
              <div className="mt-6 rounded-2xl border border-dashed border-[color:var(--px-border-strong)] px-4 py-8 text-center">
                <p className="font-bold text-[color:var(--px-text)]">
                  No matching features
                </p>
                <p className="mt-1 text-sm text-[color:var(--px-text-muted)]">
                  Try a destination, task, or feature name.
                </p>
              </div>
            ) : null}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
