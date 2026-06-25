"use client";

import {
  Bell,
  BriefcaseBusiness,
  Building2,
  FileText,
  Home,
  MessageSquare,
  Network,
  Settings,
  ShieldCheck,
  Star,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as Tooltip from "@radix-ui/react-tooltip";

import { BrandLogo, BrandSymbol } from "@/components/brand-logo";
import { useSidebar } from "./sidebar-context";
import { getAppRoute, getEnvironment, RouteKey } from "@/lib/navigation/app-routes";
import { ElementType } from "react";

const primaryLinks: Array<{ key: RouteKey, icon: ElementType, label: string }> = [
  { key: "home", icon: Home, label: "Home" },
  { key: "discover", icon: Network, label: "Discover" },
];

const workspaceLinks: Array<{ key: RouteKey, icon: ElementType, label: string }> = [
  { key: "opportunities", icon: BriefcaseBusiness, label: "Opportunities" },
  { key: "startups", icon: Building2, label: "Startups" },
  { key: "proposals_sent", icon: FileText, label: "Proposals" },
  { key: "messages", icon: MessageSquare, label: "Messages" },
  { key: "deals", icon: ShieldCheck, label: "Deals" },
  { key: "saved", icon: Star, label: "Saved" },
];

const accountLinks: Array<{ key: RouteKey, icon: ElementType, label: string }> = [
  { key: "notifications", icon: Bell, label: "Notifications" },
  { key: "settings", icon: Settings, label: "Settings" },
];

export function DashboardSidebar() {
  const pathname = usePathname();
  const env = getEnvironment(pathname);
  const { isCollapsed, toggleCollapse } = useSidebar();

  const renderLinks = (links: typeof primaryLinks) => (
    <nav className="grid gap-1">
      {links.map((item) => {
        const targetHref = getAppRoute(item.key, env);
        const isActive =
          targetHref === "/app" || targetHref === "/preview"
            ? pathname === targetHref
            : pathname.startsWith(targetHref);

        const linkContent = (
          <Link
            className={`flex h-11 items-center rounded-[var(--px-radius-sm)] py-2 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)] ${
              isCollapsed ? "justify-center px-0" : "gap-3 px-3"
            } ${
              isActive
                ? "bg-[color:var(--px-primary)] text-white shadow-[0_10px_24px_rgba(37,99,235,0.22)]"
                : "text-[color:var(--px-text-muted)] hover:bg-[color:var(--px-surface-soft)] hover:text-[color:var(--px-text)]"
            }`}
            href={targetHref}
            key={item.key}
            aria-label={isCollapsed ? item.label : undefined}
          >
            <item.icon aria-hidden size={18} />
            {!isCollapsed && <span>{item.label}</span>}
          </Link>
        );

        if (isCollapsed) {
          return (
            <Tooltip.Provider key={item.key} delayDuration={100}>
              <Tooltip.Root>
                <Tooltip.Trigger asChild>{linkContent}</Tooltip.Trigger>
                <Tooltip.Portal>
                  <Tooltip.Content
                    side="right"
                    sideOffset={14}
                    className="z-50 rounded-md border border-[color:var(--px-border)] bg-[color:var(--px-surface-elevated)] px-3 py-1.5 text-xs font-medium text-[color:var(--px-text)] shadow-md animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
                  >
                    {item.label}
                    <Tooltip.Arrow className="fill-[color:var(--px-surface-elevated)]" />
                  </Tooltip.Content>
                </Tooltip.Portal>
              </Tooltip.Root>
            </Tooltip.Provider>
          );
        }

        return linkContent;
      })}
    </nav>
  );

  return (
    <aside
      className="perx-sidebar relative z-20 hidden h-dvh shrink-0 flex-col border-r border-[color:var(--px-border)] text-[color:var(--px-text)] transition-[width] duration-300 ease-in-out lg:flex"
      style={{ width: isCollapsed ? 80 : 260 }}
    >
      <div className={`flex h-[72px] shrink-0 items-center border-b border-[color:var(--px-border)] ${isCollapsed ? "justify-center px-0" : "px-5"}`}>
        <Link href={getAppRoute("home", env)} aria-label="perX dashboard">
          <div className="overflow-hidden whitespace-nowrap">
            {isCollapsed ? (
              <BrandSymbol className="h-8 w-14 drop-shadow-[0_2px_8px_rgba(255,255,255,0.18)]" dark />
            ) : (
              <BrandLogo className="h-9 drop-shadow-[0_2px_8px_rgba(255,255,255,0.12)]" dark />
            )}
          </div>
        </Link>
      </div>

      <div className={`flex-1 space-y-8 overflow-y-auto py-6 scrollbar-hide ${isCollapsed ? "px-3" : "px-4"}`}>
        <div>
          {!isCollapsed && <h3 className="mb-2 px-3 text-xs font-bold uppercase tracking-wider text-[color:var(--px-text-muted)]">Menu</h3>}
          {renderLinks(primaryLinks)}
        </div>
        <div>
          {!isCollapsed && <h3 className="mb-2 px-3 text-xs font-bold uppercase tracking-wider text-[color:var(--px-text-muted)]">Workspace</h3>}
          {renderLinks(workspaceLinks)}
        </div>
        <div>
          {!isCollapsed && <h3 className="mb-2 px-3 text-xs font-bold uppercase tracking-wider text-[color:var(--px-text-muted)]">Account</h3>}
          {renderLinks(accountLinks)}
        </div>
      </div>

      <div className={`shrink-0 border-t border-[color:var(--px-border)] ${isCollapsed ? "p-3" : "p-4"}`}>
        {!isCollapsed && (
          <div className="mb-4 rounded-[var(--px-radius-sm)] bg-[color:var(--px-surface-soft)] p-4 ring-1 ring-[color:var(--px-border)]">
            <h4 className="text-sm font-bold text-[color:var(--px-text)]">Build your reputation</h4>
            <p className="mt-1 text-xs leading-relaxed text-[color:var(--px-text-muted)]">
              Complete your profile, verify your identity and unlock more trusted opportunities.
            </p>
            <Link
              href={getAppRoute("profile", env)}
              className="mt-3 block w-full rounded bg-[color:var(--px-primary)] px-3 py-2 text-center text-xs font-bold text-white transition-colors hover:bg-[color:var(--px-primary-strong)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)]"
            >
              Improve profile
            </Link>
          </div>
        )}
        <button
          onClick={toggleCollapse}
          className={`flex h-11 w-full items-center rounded-[var(--px-radius-sm)] py-2 text-sm font-semibold text-[color:var(--px-text-muted)] transition-colors hover:bg-[color:var(--px-surface-soft)] hover:text-[color:var(--px-text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)] ${
            isCollapsed ? "justify-center px-0" : "gap-3 px-3"
          }`}
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!isCollapsed}
        >
          {isCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          {!isCollapsed && <span>Collapse sidebar</span>}
        </button>
      </div>
    </aside>
  );
}
