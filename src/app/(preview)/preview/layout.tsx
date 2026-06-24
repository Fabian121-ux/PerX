"use client";

import type { ReactNode } from "react";
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { DashboardTopbar } from "@/components/dashboard/dashboard-topbar";
import { MobileDashboardNav } from "@/components/dashboard/mobile-dashboard-nav";
import { SidebarProvider } from "@/components/dashboard/sidebar-context";
import { previewUser } from "@/lib/data/preview";
import { AnimatedBackground } from "@/components/dashboard/animated-background";

export default function PreviewLayout({ children }: { children: ReactNode }) {
  // Convert PreviewUser to match CurrentUser structurally for the topbar
  const mockCurrentUser = {
    id: previewUser.id,
    email: previewUser.email,
    name: previewUser.name,
    username: previewUser.username,
    roles: previewUser.roles as never[],
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-dvh bg-[color:var(--px-page)] text-[color:var(--px-text)] transition-colors duration-200">
        <AnimatedBackground />
        {/* Desktop Sidebar */}
      <DashboardSidebar />
      
      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col pb-20 lg:pb-0">
        <DashboardTopbar user={mockCurrentUser} previewMode={true} />
        
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl">
            {children}
          </div>
        </main>

        {/* Mobile Bottom Navigation */}
        <MobileDashboardNav />
      </div>
    </div>
    </SidebarProvider>
  );
}
