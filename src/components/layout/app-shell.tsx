"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useState, type ReactNode } from "react";
import { X } from "lucide-react";
import type { CurrentUser } from "@/lib/auth/session";

import {
  DashboardSidebar,
  SidebarNavigation,
} from "@/components/dashboard/dashboard-sidebar";
import { DashboardTopbar } from "@/components/dashboard/dashboard-topbar";
import { AnimatedBackground } from "@/components/dashboard/animated-background";
import { BrandLogo } from "@/components/brand-logo";

export function AppShell({
  children,
  user,
}: {
  children: ReactNode;
  user: CurrentUser;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="perx-shell relative flex h-dvh overflow-hidden bg-[color:var(--px-page)] text-[color:var(--px-text)] transition-colors duration-200">
      <AnimatedBackground />
      <DashboardSidebar userRoles={user.roles} />
      <MobileDashboardDrawer
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        userRoles={user.roles}
      />

      <div className="relative z-10 flex min-w-0 flex-1 flex-col overflow-hidden">
        <DashboardTopbar user={user} onMenuClick={() => setMobileOpen(true)} />

        <main className="dashboard-main min-h-0 flex-1 overflow-y-auto px-4 pt-4 sm:px-6 sm:pt-6 lg:px-8 lg:pt-8">
          <div className="mx-auto max-w-[1480px]">{children}</div>
        </main>
      </div>
    </div>
  );
}

export function MobileDashboardDrawer({
  open,
  onClose,
  userRoles,
}: {
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
            <BrandLogo
              className="h-9 drop-shadow-[0_2px_8px_rgba(255,255,255,0.12)]"
              dark
            />
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
            <SidebarNavigation onNavigate={onClose} userRoles={userRoles} />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
