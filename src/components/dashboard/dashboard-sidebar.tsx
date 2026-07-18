"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { BrandLogo } from "@/components/brand-logo";
import {
  isSidebarItemActive,
  sidebarGroups,
  sidebarItems,
  type SidebarItem,
} from "@/lib/navigation/sidebar-items";

function SidebarLink({
  item,
  onNavigate,
}: {
  item: SidebarItem;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const href = getRenderedHref(item.href, pathname);
  const active = isSidebarItemActive(pathname, { ...item, href });
  const Icon = item.icon;

  return (
    <Link
      aria-current={active ? "page" : undefined}
      aria-label={item.label}
      className={`group flex min-h-10 w-full items-center gap-3 rounded-[10px] px-3 py-2 text-[13px] font-semibold leading-tight transition duration-150 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--px-sidebar)] ${
        active
          ? "bg-[color:var(--px-primary)] text-white shadow-[0_10px_22px_rgba(37,99,235,0.32)]"
          : "text-[color:var(--px-text-muted)] hover:bg-white/10 hover:text-white"
      }`}
      href={href}
      onClick={onNavigate}
    >
      <Icon
        aria-hidden
        className={`h-[18px] w-[18px] shrink-0 stroke-[2.15] transition-colors ${
          active
            ? "text-white"
            : "text-[color:var(--px-text-muted)] group-hover:text-white"
        }`}
      />
      <span className="min-w-0 flex-1 truncate text-left">{item.label}</span>
    </Link>
  );
}

function getRenderedHref(href: string, pathname: string) {
  if (!pathname.startsWith("/preview")) {
    return href;
  }

  if (href === "/app") return "/preview";
  if (href === "/app/deals") return "/preview/deals/demo-deal";
  if (href === "/app/profile/edit") return "/preview/profile";
  if (href.startsWith("/app/")) return `/preview${href.slice(4)}`;

  if (href === "/dashboard") return "/preview";
  if (href === "/messages") return "/preview/messages";
  if (href === "/notifications") return "/preview/notifications";
  if (href === "/saved") return "/preview/saved";
  if (href === "/settings") return "/preview/settings";

  return `/preview${href}`;
}

export function SidebarNavigation({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav aria-label="Sidebar navigation" className="grid gap-5">
      {sidebarGroups.map((group) => {
        const items = sidebarItems.filter((item) => item.group === group.key);

        return (
          <section className="grid gap-1.5" key={group.key}>
            <h2 className="px-3 text-[10px] font-black uppercase tracking-[0.12em] text-white/45">
              {group.label}
            </h2>
            <div className="grid gap-1">
              {items.map((item) => (
                <SidebarLink
                  item={item}
                  key={item.href}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          </section>
        );
      })}
    </nav>
  );
}

export function DashboardSidebar() {
  const isDesktop = useIsDesktop();

  if (!isDesktop) {
    return null;
  }

  return (
    <aside className="perx-sidebar relative z-20 flex h-dvh w-[224px] shrink-0 flex-col border-r border-white/10 text-white shadow-[18px_0_44px_rgba(2,10,26,0.22)]">
      <div className="flex h-[86px] shrink-0 items-center px-5">
        <BrandLogo
          className="h-10 max-w-[152px] drop-shadow-[0_2px_8px_rgba(255,255,255,0.12)]"
          dark
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-5 pt-1">
        <SidebarNavigation />
      </div>
    </aside>
  );
}

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsDesktop(query.matches);

    update();
    query.addEventListener("change", update);

    return () => query.removeEventListener("change", update);
  }, []);

  return isDesktop;
}
