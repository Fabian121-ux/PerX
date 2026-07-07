import type { LucideIcon } from "lucide-react";
import {
  Bell,
  BriefcaseBusiness,
  ClipboardList,
  LayoutDashboard,
  MessageSquare,
  Settings,
  ShieldCheck,
  Store,
  UsersRound,
} from "lucide-react";

export type SidebarGroup = "main" | "explore" | "money" | "support";

export type SidebarItem = {
  exact?: boolean;
  group: SidebarGroup;
  href: string;
  icon: LucideIcon;
  label: string;
};

export const sidebarItems: SidebarItem[] = [
  {
    exact: true,
    group: "main",
    href: "/dashboard",
    icon: LayoutDashboard,
    label: "Home Dashboard",
  },
  {
    group: "main",
    href: "/discover",
    icon: Store,
    label: "Discover",
  },
  {
    group: "explore",
    href: "/network",
    icon: UsersRound,
    label: "Network",
  },
  {
    group: "explore",
    href: "/app/opportunities",
    icon: BriefcaseBusiness,
    label: "Opportunities",
  },
  {
    group: "explore",
    href: "/app/proposals/sent",
    icon: ClipboardList,
    label: "Proposals",
  },
  {
    group: "explore",
    href: "/deals",
    icon: ShieldCheck,
    label: "Deals",
  },
  {
    group: "money",
    href: "/escrow",
    icon: ShieldCheck,
    label: "Escrow",
  },
  {
    group: "support",
    href: "/messages",
    icon: MessageSquare,
    label: "Messages",
  },
  {
    group: "support",
    href: "/notifications",
    icon: Bell,
    label: "Notifications",
  },
  {
    group: "support",
    href: "/settings",
    icon: Settings,
    label: "Settings",
  },
];

export const sidebarGroups: Array<{ key: SidebarGroup; label: string }> = [
  { key: "main", label: "Main" },
  { key: "explore", label: "Explore" },
  { key: "money", label: "Money" },
  { key: "support", label: "Support" },
];

export function isSidebarItemActive(pathname: string, item: SidebarItem) {
  if (item.exact) {
    return pathname === item.href;
  }

  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
