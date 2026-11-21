import Link from "next/link";
import type { ReactNode } from "react";

import { AdminNavigation, type AdminNavigationGroup } from "@/components/admin/admin-navigation";
import { BrandLogo } from "@/components/brand-logo";
import { SignOutButton } from "@/components/auth/sign-out-button";
import type { CurrentUser } from "@/lib/auth/session";
import { hasCapability, type Capability, type RoleName } from "@/lib/permissions/capabilities";

type AdminNavigationItem = {
  capability: Capability;
  href: string;
  label: string;
};

const navigationGroups: Array<{
  title: string;
  links: AdminNavigationItem[];
}> = [
  {
    title: "Overview",
    links: [
      { href: "/admin", label: "Dashboard", capability: "admin:access" },
      { href: "/admin/activity", label: "Activity", capability: "admin:access" },
    ],
  },
  {
    title: "People & marketplace",
    links: [
      { href: "/admin/users", label: "Users", capability: "users:read" },
      { href: "/admin/trader-applications", label: "Trader applications", capability: "users:manage" },
      { href: "/admin/profiles", label: "Profiles", capability: "users:read" },
      { href: "/admin/verification", label: "Verification", capability: "admin:moderate" },
      { href: "/admin/opportunities", label: "Opportunities", capability: "opportunity:moderate" },
      // Existing property listings still need moderation after the member-facing vertical was retired.
      { href: "/admin/real-estate", label: "Property (legacy)", capability: "opportunity:moderate" },
      { href: "/admin/deals", label: "Deals", capability: "deals:review" },
      { href: "/admin/disputes", label: "Disputes", capability: "deals:review" },
    ],
  },
  {
    title: "Trust & safety",
    links: [
      { href: "/admin/messages", label: "Messages", capability: "messages:moderate" },
      { href: "/admin/moderation", label: "Moderation cases", capability: "admin:moderate" },
      { href: "/admin/social", label: "Social moderation", capability: "admin:moderate" },
      { href: "/admin/reports", label: "Reports", capability: "reports:review" },
      { href: "/admin/reviews", label: "Reviews", capability: "reports:review" },
    ],
  },
  {
    title: "Administration",
    links: [
      { href: "/admin/broadcasts", label: "Broadcasts", capability: "broadcasts:create" },
      { href: "/admin/support", label: "Support", capability: "support:manage" },
      { href: "/admin/audit", label: "Audit trail", capability: "audit:read" },
      { href: "/admin/policies", label: "Policies", capability: "policies:manage" },
      { href: "/admin/schema", label: "Schema status", capability: "settings:manage" },
      { href: "/admin/settings", label: "Settings", capability: "settings:manage" },
    ],
  },
];

export function getAdminNavigationGroups(roles: RoleName[]): AdminNavigationGroup[] {
  return navigationGroups
    .map((group) => ({
      title: group.title,
      links: group.links
        .filter((link) => hasCapability(roles, link.capability))
        .map(({ href, label }) => ({ href, label })),
    }))
    .filter((group) => group.links.length > 0);
}

export function AdminShell({
  children,
  user,
}: {
  children: ReactNode;
  user: CurrentUser;
}) {
  const groups = getAdminNavigationGroups(user.roles);

  return (
    <div className="min-h-dvh bg-slate-950 text-white">
      <a
        className="sr-only fixed left-4 top-4 z-50 rounded-lg bg-white px-4 py-2 text-sm font-bold text-slate-950 focus:not-sr-only focus:outline-none focus:ring-2 focus:ring-cyan-300"
        href="#admin-main"
      >
        Skip to admin content
      </a>
      <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/95 backdrop-blur">
        <div className="mx-auto flex min-h-16 min-w-0 max-w-[1600px] items-center justify-between gap-2 px-3 sm:gap-4 sm:px-6 lg:px-8">
          <Link
            className="inline-flex min-w-0 shrink-0 items-center gap-2 sm:gap-3"
            href="/admin"
            aria-label="PtahX admin dashboard"
          >
            <BrandLogo className="h-9 w-auto sm:hidden" compact dark />
            <BrandLogo className="hidden h-10 w-auto sm:block" dark />
            <span className="hidden rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs font-bold text-cyan-100 sm:inline-flex">
              Admin
            </span>
          </Link>
          <div className="flex min-w-0 shrink-0 items-center gap-2 sm:gap-3">
            <div className="hidden text-right sm:block">
              <p className="max-w-48 truncate text-xs font-semibold text-white">{user.name}</p>
              <p className="max-w-48 truncate text-[11px] text-slate-400">@{user.username}</p>
            </div>
            <Link
              className="inline-flex min-h-11 shrink-0 items-center rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-xs font-semibold text-white transition hover:border-cyan-300/50 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 sm:text-sm"
              href="/app"
            >
              User app
            </Link>
            <SignOutButton className="inline-flex min-h-11 max-w-36 shrink-0 items-center gap-2 overflow-hidden text-ellipsis whitespace-nowrap rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-xs font-semibold text-white transition hover:border-cyan-300/50 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:opacity-70 sm:max-w-none sm:text-sm" />
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1600px] gap-5 px-4 py-5 sm:px-6 lg:grid-cols-[248px_minmax(0,1fr)] lg:gap-7 lg:px-8 lg:py-7">
        <AdminNavigation groups={groups} />
        <main className="min-w-0 scroll-mt-24" id="admin-main">
          {children}
        </main>
      </div>
    </div>
  );
}
