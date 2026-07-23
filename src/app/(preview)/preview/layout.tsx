"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { DashboardTopbar } from "@/components/dashboard/dashboard-topbar";
import { previewUser } from "@/lib/data/preview";
import { AnimatedBackground } from "@/components/dashboard/animated-background";
import { MobileDashboardDrawer } from "@/components/layout/app-shell";

export default function PreviewLayout({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  // Convert PreviewUser to match CurrentUser structurally for the topbar
  const mockCurrentUser = {
    id: previewUser.id,
    email: previewUser.email,
    name: previewUser.name,
    username: previewUser.username,
    roles: previewUser.roles as never[],
  };

  return (
    <div className="perx-shell relative flex h-dvh overflow-hidden bg-[color:var(--px-page)] text-[color:var(--px-text)] transition-colors duration-200">
      <AnimatedBackground />
      <DashboardSidebar userRoles={mockCurrentUser.roles} />
      <MobileDashboardDrawer
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        userRoles={mockCurrentUser.roles}
      />

      <div className="relative z-10 flex min-w-0 flex-1 flex-col overflow-hidden">
        <DashboardTopbar
          user={mockCurrentUser}
          previewMode
          onMenuClick={() => setMobileOpen(true)}
        />

        <main className="dashboard-main min-h-0 flex-1 overflow-y-auto px-4 pt-4 sm:px-6 sm:pt-6 lg:px-8 lg:pt-8">
          <div className="mx-auto max-w-[1480px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
