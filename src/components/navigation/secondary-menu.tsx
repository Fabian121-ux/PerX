"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactElement } from "react";

import type { CurrentUser } from "@/lib/auth/session";
import type { UnreadCounts } from "@/lib/data/unread-counts";
import {
  getFeatureById,
  secondaryNavigation,
} from "@/lib/navigation/feature-registry";
import {
  isNavigationItemActive,
  shouldShowNavigationDot,
} from "@/lib/navigation/navigation-state";

export function SecondaryMenu({
  children,
  unreadCounts,
  user,
}: {
  children?: ReactElement;
  unreadCounts: UnreadCounts;
  user: CurrentUser;
}) {
  const pathname = usePathname();

  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        {children ?? (
          <button
            aria-label="Open secondary menu"
            className="grid h-11 w-11 place-items-center rounded-xl border border-[color:var(--px-border)] bg-[color:var(--px-surface)] text-[color:var(--px-text)] transition hover:bg-[color:var(--px-surface-soft)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)]"
            type="button"
          >
            <Menu aria-hidden size={22} />
          </button>
        )}
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[70] bg-[color:var(--px-overlay)] backdrop-blur-[2px] lg:hidden" />
        <Dialog.Content className="fixed inset-y-0 right-0 z-[71] flex h-dvh w-[min(22rem,calc(100vw-2rem))] flex-col border-l border-[color:var(--px-border)] bg-[color:var(--px-surface)] shadow-[var(--px-shadow-strong)] focus:outline-none lg:hidden">
          <div className="flex min-h-16 items-center justify-between border-b border-[color:var(--px-border)] px-4">
            <div>
              <Dialog.Title className="font-black text-[color:var(--px-text)]">
                More from PerX
              </Dialog.Title>
              <Dialog.Description className="sr-only">
                Account, news, support, and settings links
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                aria-label="Close secondary menu"
                className="grid h-11 w-11 place-items-center rounded-full text-[color:var(--px-text-muted)] transition hover:bg-[color:var(--px-surface-soft)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)]"
                type="button"
              >
                <X aria-hidden size={20} />
              </button>
            </Dialog.Close>
          </div>

          <div className="border-b border-[color:var(--px-border)] px-4 py-4">
            <p className="truncate text-sm font-black text-[color:var(--px-text)]">
              {user.name}
            </p>
            <p className="mt-0.5 truncate text-xs text-[color:var(--px-text-muted)]">
              {user.email}
            </p>
          </div>

          <nav
            aria-label="Secondary navigation"
            className="min-h-0 flex-1 overflow-y-auto px-3 py-4"
          >
            <div className="grid gap-1">
              {secondaryNavigation.map((item) => {
                const feature = getFeatureById(item.featureId);
                const Icon = feature.icon;
                const active = isNavigationItemActive(pathname, feature.href, {
                  aliases: feature.activePaths,
                  exact: feature.exact,
                });
                const showUnreadNews =
                  item.featureId === "news" &&
                  shouldShowNavigationDot(unreadCounts.unreadNews);

                return (
                  <Dialog.Close asChild key={item.featureId}>
                    <Link
                      aria-current={active ? "page" : undefined}
                      aria-label={
                        showUnreadNews ? `${item.label}, unread` : item.label
                      }
                      className={`flex min-h-12 items-center gap-3 rounded-xl px-3 py-2 text-sm font-bold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)] ${
                        active
                          ? "bg-[color:var(--px-primary-soft)] text-[color:var(--px-primary)]"
                          : "text-[color:var(--px-text)] hover:bg-[color:var(--px-surface-soft)]"
                      }`}
                      href={feature.href}
                    >
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[color:var(--px-muted)] text-[color:var(--px-text-muted)]">
                        <Icon aria-hidden size={18} />
                      </span>
                      <span className="min-w-0 flex-1 truncate">
                        {item.label}
                      </span>
                      {showUnreadNews ? (
                        <span
                          aria-hidden
                          className="h-2.5 w-2.5 rounded-full bg-[color:var(--px-warning)] ring-2 ring-[color:var(--px-surface)]"
                        />
                      ) : null}
                    </Link>
                  </Dialog.Close>
                );
              })}
            </div>
          </nav>

          <div className="border-t border-[color:var(--px-border)] px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 text-xs leading-5 text-[color:var(--px-text-muted)]">
            Primary destinations stay in the bottom navigation.
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
