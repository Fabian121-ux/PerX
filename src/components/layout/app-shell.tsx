"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { CurrentUser } from "@/lib/auth/session";

import {
  DashboardSidebar,
  SidebarNavigation,
} from "@/components/dashboard/dashboard-sidebar";
import { DashboardTopbar } from "@/components/dashboard/dashboard-topbar";
import { AnimatedBackground } from "@/components/dashboard/animated-background";
import { BrandLogo } from "@/components/brand-logo";
import { AppScrollRestoration } from "@/components/layout/app-scroll-restoration";
import { PresenceHeartbeat } from "@/components/layout/presence-heartbeat";
import { AuthenticatedMobileNav } from "@/components/navigation/authenticated-mobile-nav";
import type { UnreadCounts } from "@/lib/data/unread-counts";

export function AppShell({
  children,
  unreadCounts,
  user,
}: {
  children: ReactNode;
  unreadCounts: UnreadCounts;
  user: CurrentUser;
}) {
  const [liveUnreadCounts, setLiveUnreadCounts] = useState(unreadCounts);
  const pathname = usePathname();
  const directMessageConversation = /^\/app\/messages\/[^/]+$/.test(pathname);

  useEffect(() => {
    let stopped = false;
    const channel =
      typeof BroadcastChannel !== "undefined"
        ? new BroadcastChannel("perx-unread-counts")
        : null;

    const refresh = async () => {
      try {
        const response = await fetch("/api/unread-counts", {
          cache: "no-store",
        });
        if (!response.ok) return;
        const nextCounts = (await response.json()) as UnreadCounts;
        if (stopped) return;
        setLiveUnreadCounts(nextCounts);
        channel?.postMessage(nextCounts);
      } catch {
        // Existing server-rendered counts remain visible until the next successful refresh.
      }
    };

    channel?.addEventListener(
      "message",
      (event: MessageEvent<UnreadCounts>) => {
        if (event.data) setLiveUnreadCounts(event.data);
      },
    );
    window.addEventListener("focus", refresh);
    window.addEventListener("perx-unread-refresh", refresh);
    const interval = window.setInterval(refresh, 15_000);

    return () => {
      stopped = true;
      channel?.close();
      window.removeEventListener("focus", refresh);
      window.removeEventListener("perx-unread-refresh", refresh);
      window.clearInterval(interval);
    };
  }, []);

  return (
    <div
      className={`perx-shell relative flex h-dvh overflow-hidden bg-[color:var(--px-page)] text-[color:var(--px-text)] transition-colors duration-200 ${directMessageConversation ? "perx-mobile-conversation-active" : ""}`}
    >
      <AnimatedBackground />
      <PresenceHeartbeat />
      <DashboardSidebar
        badges={liveUnreadCounts}
        featureDirectory
        userRoles={user.roles}
      />

      <div className="relative z-10 flex min-w-0 flex-1 flex-col overflow-hidden">
        <DashboardTopbar
          featureDirectory
          secondaryMenu
          unreadCounts={liveUnreadCounts}
          user={user}
        />

        <main className="dashboard-main min-h-0 flex-1 overflow-y-auto px-4 pt-4 sm:px-6 sm:pt-6 lg:px-8 lg:pt-8">
          <AppScrollRestoration />
          <div className="dashboard-content mx-auto max-w-[1480px]">
            {children}
          </div>
        </main>
      </div>
      <AuthenticatedMobileNav unreadCounts={liveUnreadCounts} />
    </div>
  );
}

export function MobileDashboardDrawer({
  badges,
  open,
  onClose,
  userRoles,
}: {
  badges: UnreadCounts;
  open: boolean;
  onClose: () => void;
  userRoles: readonly string[];
}) {
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70 lg:hidden" />
        <Dialog.Content className="perx-sidebar fixed inset-y-0 left-0 z-50 flex h-full w-[min(20rem,calc(100vw-2rem))] flex-col border-r border-white/10 p-4 shadow-2xl focus:outline-none lg:hidden">
          <Dialog.Title className="sr-only">Navigation menu</Dialog.Title>
          <div className="flex h-14 shrink-0 items-center justify-between">
            <Dialog.Close asChild>
              <Link aria-label="PerX Home" href="/app">
                <BrandLogo
                  className="h-9 drop-shadow-[0_2px_8px_rgba(255,255,255,0.12)]"
                  dark
                />
              </Link>
            </Dialog.Close>
            <Dialog.Close asChild>
              <button
                className="flex h-11 w-11 items-center justify-center rounded-full text-[color:var(--px-text-muted)] transition-colors hover:bg-[color:var(--px-surface-soft)] hover:text-[color:var(--px-text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)]"
                aria-label="Close navigation menu"
                type="button"
              >
                <X aria-hidden size={20} />
              </button>
            </Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto pb-4 pt-4">
            <SidebarNavigation
              badges={badges}
              onNavigate={onClose}
              userRoles={userRoles}
            />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
