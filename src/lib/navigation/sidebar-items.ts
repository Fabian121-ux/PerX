import type { LucideIcon } from "lucide-react";
import {
  Bell,
  BriefcaseBusiness,
  ClipboardList,
  Handshake,
  Home,
  MessageSquare,
  Settings,
  Store,
  UsersRound,
} from "lucide-react";

export type SidebarGroup = "main" | "work" | "support";

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
    href: "/app",
    icon: Home,
    label: "Home",
  },
  {
    group: "main",
    href: "/app/discover",
    icon: Store,
    label: "Discover",
  },
  {
    group: "work",
    href: "/network",
    icon: UsersRound,
    label: "Network",
  },
  {
    group: "work",
    href: "/app/opportunities",
    icon: BriefcaseBusiness,
    label: "Listings",
  },
  {
    group: "work",
    href: "/app/proposals/sent",
    icon: ClipboardList,
    label: "Proposals",
  },
  {
    group: "work",
    href: "/app/deals",
    icon: Handshake,
    label: "Agreements",
  },
  {
    group: "support",
    href: "/app/messages",
    icon: MessageSquare,
    label: "Messages",
  },
  {
    group: "support",
    href: "/app/notifications",
    icon: Bell,
    label: "Notifications",
  },
  {
    group: "support",
    href: "/app/settings",
    icon: Settings,
    label: "Settings",
  },
];

export const sidebarGroups: Array<{ key: SidebarGroup; label: string }> = [
  { key: "main", label: "Main" },
  { key: "work", label: "Work" },
  { key: "support", label: "Support" },
];

export function isSidebarItemActive(pathname: string, item: SidebarItem) {
  if (item.exact) {
    return pathname === item.href;
  }

  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
