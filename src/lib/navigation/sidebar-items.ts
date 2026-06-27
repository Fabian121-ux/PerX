import type { LucideIcon } from "lucide-react";
import {
  Bell,
  Bookmark,
  BriefcaseBusiness,
  Building2,
  ClipboardList,
  Headphones,
  LayoutDashboard,
  MessageSquare,
  Plane,
  Settings,
  ShieldCheck,
  Store,
  Truck,
  UsersRound,
  WalletCards,
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
    group: "explore",
    href: "/network",
    icon: UsersRound,
    label: "Network/Friends",
  },
  {
    group: "explore",
    href: "/real-estate",
    icon: Building2,
    label: "Real Estate",
  },
  {
    group: "explore",
    href: "/logistics",
    icon: Truck,
    label: "Logistics",
  },
  {
    group: "explore",
    href: "/travel-stay",
    icon: Plane,
    label: "Travel & Stay",
  },
  {
    group: "explore",
    href: "/services",
    icon: BriefcaseBusiness,
    label: "Services",
  },
  {
    group: "explore",
    href: "/market",
    icon: Store,
    label: "Market",
  },
  {
    group: "money",
    href: "/wallet",
    icon: WalletCards,
    label: "Wallet",
  },
  {
    group: "money",
    href: "/escrow",
    icon: ShieldCheck,
    label: "Escrow",
  },
  {
    group: "support",
    href: "/service-center",
    icon: Headphones,
    label: "Service Center",
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
    href: "/saved",
    icon: Bookmark,
    label: "Saved",
  },
  {
    group: "support",
    href: "/reports",
    icon: ClipboardList,
    label: "Reports",
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
