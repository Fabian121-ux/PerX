"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useSoftwareKeyboard } from "@/components/layout/software-keyboard-provider";
import type { UnreadCounts } from "@/lib/data/unread-counts";
import {
  authenticatedMobileNavigation,
  canAccessFeature,
  getFeatureById,
} from "@/lib/navigation/feature-registry";
import {
  formatNavigationBadge,
  isNavigationItemActive,
} from "@/lib/navigation/navigation-state";

export function AuthenticatedMobileNav({
  unreadCounts,
  userRoles,
}: {
  unreadCounts: UnreadCounts;
  userRoles: readonly string[];
}) {
  const pathname = usePathname();
  const keyboard = useSoftwareKeyboard();
  const navigation = authenticatedMobileNavigation.filter((item) =>
    canAccessFeature(getFeatureById(item.featureId), userRoles),
  );

  // While the on-screen keyboard is open the bar is removed from the tree
  // entirely rather than hidden with CSS. Hiding it visually would leave it in
  // the tab order and still expose it to screen readers, and on
  // `resizes-content` platforms a merely-transparent fixed element continues
  // to occupy the strip directly above the keyboard.
  if (keyboard.open) return null;

  return (
    <nav
      aria-label="Primary navigation"
      className="authenticated-mobile-nav fixed inset-x-0 bottom-0 z-40 border-t border-[color:var(--px-border)] bg-[color:var(--px-surface)]/96 pb-[env(safe-area-inset-bottom)] shadow-[0_-12px_30px_rgba(15,23,42,0.12)] backdrop-blur-xl lg:hidden"
    >
      <div
        className="mx-auto grid h-[var(--mobile-nav-height)] max-w-xl px-1"
        style={{
          gridTemplateColumns: `repeat(${navigation.length}, minmax(0, 1fr))`,
        }}
      >
        {navigation.map((item) => {
          const feature = getFeatureById(item.featureId);
          const label = item.label ?? feature.label;
          const active = isNavigationItemActive(pathname, feature.href, {
            aliases: [
              ...(feature.activePaths ?? []),
              ...(("activePaths" in item ? item.activePaths : undefined) ?? []),
            ],
            exact: feature.exact,
          });
          const badge =
            item.featureId === "messages"
              ? formatNavigationBadge(unreadCounts.unreadConversations)
              : item.featureId === "connections"
                ? formatNavigationBadge(unreadCounts.pendingConnectionRequests)
                : null;
          const Icon = feature.icon;

          if ("prominent" in item && item.prominent) {
            return (
              <Link
                aria-current={active ? "page" : undefined}
                aria-label={label}
                className="group relative -top-3 flex min-h-16 min-w-11 flex-col items-center justify-start gap-1 rounded-2xl px-1 pt-0.5 text-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)]"
                href={feature.href}
                key={feature.id}
              >
                <span
                  className={`grid h-14 w-14 place-items-center rounded-full border-4 border-[color:var(--px-surface)] shadow-[0_10px_24px_rgba(37,99,235,0.3)] transition group-active:scale-95 ${
                    active
                      ? "bg-[color:var(--px-primary-strong)] text-white ring-2 ring-[color:var(--px-primary)]/40"
                      : "bg-[color:var(--px-primary)] text-white"
                  }`}
                >
                  <Icon aria-hidden size={24} strokeWidth={2.4} />
                </span>
                <span className="text-[10px] font-black leading-3 text-[color:var(--px-primary)]">
                  {label}
                </span>
              </Link>
            );
          }

          return (
            <Link
              aria-current={active ? "page" : undefined}
              aria-label={
                badge
                  ? item.featureId === "messages"
                    ? `${label}, ${badge} unread conversations`
                    : `${label}, ${badge} pending connection requests`
                  : label
              }
              className={`relative flex min-h-11 min-w-11 flex-col items-center justify-center gap-1 rounded-xl px-1 pb-1 pt-2 text-center transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)] ${
                active
                  ? "text-[color:var(--px-primary)]"
                  : "text-[color:var(--px-text-muted)] hover:text-[color:var(--px-text)]"
              }`}
              href={feature.href}
              key={feature.id}
            >
              {/*
                Non-colour active indicator. Colour alone does not satisfy
                WCAG 1.4.1, and the muted/active blue pair is indistinguishable
                for some users, so the active tab also carries a top rule and a
                heavier icon stroke. `aria-current` covers assistive tech.
              */}
              <span
                aria-hidden
                className={`absolute inset-x-3 top-0 h-0.5 rounded-full transition ${
                  active ? "bg-[color:var(--px-primary)]" : "bg-transparent"
                }`}
              />
              <span className="relative grid h-7 w-8 place-items-center">
                <Icon aria-hidden size={21} strokeWidth={active ? 2.6 : 2} />
                {badge ? (
                  <span
                    aria-hidden
                    className="absolute -right-2 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-[color:var(--px-warning)] px-1 text-[9px] font-black leading-none text-white ring-2 ring-[color:var(--px-surface)]"
                  >
                    {badge}
                  </span>
                ) : null}
              </span>
              <span
                className={`max-w-full truncate text-[10px] leading-3 ${
                  active ? "font-black" : "font-bold"
                }`}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
