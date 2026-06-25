"use client";

import { Home, MessageSquare, Network, Plus, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getAppRoute, getEnvironment } from "@/lib/navigation/app-routes";

export function MobileDashboardNav() {
  const pathname = usePathname();

  const getHref = (key: Parameters<typeof getAppRoute>[0]) => getAppRoute(key, getEnvironment(pathname));

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-[color:var(--px-border)] bg-[color:var(--px-navy-2)]/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-16px_38px_rgba(0,0,0,0.34)] backdrop-blur lg:hidden">
      <div className="flex h-[var(--mobile-nav-height)] items-center justify-around px-1.5">
        {/* Home */}
        <Link
          href={getHref("home")}
          className={`flex h-full w-[3.75rem] min-w-0 flex-col items-center justify-center gap-1 rounded-xl ${
            pathname === getHref("home") || pathname === "/app" || pathname === "/preview" ? "text-[color:var(--px-primary)]" : "text-[color:var(--px-text-muted)] hover:text-[color:var(--px-text)]"
          }`}
        >
          <Home size={20} className={pathname === getHref("home") || pathname === "/app" || pathname === "/preview" ? "fill-current opacity-20 stroke-2" : ""} />
          <span className="text-[10px] font-semibold">Home</span>
        </Link>

        {/* Discover */}
        <Link
          href={getHref("discover")}
          className={`flex h-full w-[3.75rem] min-w-0 flex-col items-center justify-center gap-1 rounded-xl ${
            pathname.startsWith(getHref("discover")) ? "text-[color:var(--px-primary)]" : "text-[color:var(--px-text-muted)] hover:text-[color:var(--px-text)]"
          }`}
        >
          <Network size={20} className={pathname.startsWith(getHref("discover")) ? "fill-current opacity-20 stroke-2" : ""} />
          <span className="text-[10px] font-semibold">Discover</span>
        </Link>

        {/* Prominent Create Action */}
        <div className="relative -top-5 flex w-16 shrink-0 flex-col items-center">
          <Link
            href={getHref("new_opportunity")}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-[color:var(--px-primary)] text-white shadow-lg ring-4 ring-[color:var(--px-navy-2)] transition-transform hover:bg-[color:var(--px-primary-strong)] active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)]"
            aria-label="Create opportunity"
          >
            <Plus size={28} />
          </Link>
          <span className="mt-1 text-[10px] font-semibold text-[color:var(--px-text-muted)]">Create</span>
        </div>

        {/* Messages */}
        <Link
          href={getHref("messages")}
          className={`flex h-full w-[3.75rem] min-w-0 flex-col items-center justify-center gap-1 rounded-xl ${
            pathname.startsWith(getHref("messages")) ? "text-[color:var(--px-primary)]" : "text-[color:var(--px-text-muted)] hover:text-[color:var(--px-text)]"
          }`}
        >
          <MessageSquare size={20} />
          <span className="text-[10px] font-semibold">Messages</span>
        </Link>

        {/* Deals */}
        <Link
          href={getHref("deals")}
          className={`flex h-full w-[3.75rem] min-w-0 flex-col items-center justify-center gap-1 rounded-xl ${
            pathname.startsWith(getHref("deals")) ? "text-[color:var(--px-primary)]" : "text-[color:var(--px-text-muted)] hover:text-[color:var(--px-text)]"
          }`}
        >
          <ShieldCheck size={20} />
          <span className="text-[10px] font-semibold">Deals</span>
        </Link>
      </div>
    </div>
  );
}
