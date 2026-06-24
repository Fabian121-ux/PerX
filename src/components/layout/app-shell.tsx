"use client";

import { useState, type ReactNode } from "react";
import { X, Home, Network, BriefcaseBusiness, FileText, MessageSquare, ShieldCheck, Star, Bell, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { CurrentUser } from "@/lib/auth/session";

import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { DashboardTopbar } from "@/components/dashboard/dashboard-topbar";
import { MobileDashboardNav } from "@/components/dashboard/mobile-dashboard-nav";
import { SidebarProvider } from "@/components/dashboard/sidebar-context";
import { AnimatedBackground } from "@/components/dashboard/animated-background";
import { BrandLogo } from "@/components/brand-logo";
import { getAppRoute, getEnvironment, type RouteKey } from "@/lib/navigation/app-routes";

export function AppShell({ children, user }: { children: ReactNode; user: CurrentUser }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <SidebarProvider>
      <div className="flex min-h-dvh overflow-x-hidden bg-[color:var(--px-page)] text-[color:var(--px-text)] transition-colors duration-200">
        <AnimatedBackground />
        <DashboardSidebar />
        <MobileDashboardDrawer open={mobileOpen} onClose={() => setMobileOpen(false)} />

        <div className="flex min-w-0 flex-1 flex-col">
          <DashboardTopbar user={user} onMenuClick={() => setMobileOpen(true)} />

          <main className="dashboard-main flex-1 px-4 pt-4 sm:px-6 sm:pt-6 lg:px-8 lg:pt-8">
            <div className="mx-auto max-w-[1480px]">{children}</div>
          </main>

          <MobileDashboardNav />
        </div>
      </div>
    </SidebarProvider>
  );
}

const mobileLinks: Array<{ key: RouteKey; icon: typeof Home; label: string }> = [
  { key: "home", icon: Home, label: "Home" },
  { key: "discover", icon: Network, label: "Discover" },
  { key: "opportunities", icon: BriefcaseBusiness, label: "Opportunities" },
  { key: "proposals_sent", icon: FileText, label: "Proposals" },
  { key: "messages", icon: MessageSquare, label: "Messages" },
  { key: "deals", icon: ShieldCheck, label: "Deals" },
  { key: "saved", icon: Star, label: "Saved" },
  { key: "notifications", icon: Bell, label: "Notifications" },
  { key: "settings", icon: Settings, label: "Settings" },
];

function MobileDashboardDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const env = getEnvironment(pathname);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation menu">
      <button
        className="absolute inset-0 bg-black/70"
        onClick={onClose}
        aria-label="Close navigation menu"
        type="button"
      />
      <div className="relative flex h-full w-[min(22rem,calc(100vw-2rem))] flex-col border-r border-[color:var(--px-border)] bg-[color:var(--px-navy-2)] p-4 shadow-2xl">
        <div className="flex h-12 items-center justify-between">
          <BrandLogo className="h-8" dark />
          <button
            className="flex h-11 w-11 items-center justify-center rounded-full text-[color:var(--px-text-muted)] transition-colors hover:bg-[color:var(--px-surface-soft)] hover:text-[color:var(--px-text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)]"
            onClick={onClose}
            aria-label="Close navigation menu"
            type="button"
          >
            <X size={20} />
          </button>
        </div>
        <nav className="mt-6 grid gap-1">
          {mobileLinks.map((item) => {
            const href = getAppRoute(item.key, env);
            const isActive = href === `/${env}` ? pathname === href : pathname.startsWith(href);
            return (
              <Link
                key={item.key}
                href={href}
                onClick={onClose}
                className={`flex h-12 items-center gap-3 rounded-[var(--px-radius-sm)] px-3 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)] ${
                  isActive
                    ? "bg-[color:var(--px-primary)] text-[#070707]"
                    : "text-[color:var(--px-text-muted)] hover:bg-[color:var(--px-surface-soft)] hover:text-[color:var(--px-text)]"
                }`}
              >
                <item.icon size={18} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
