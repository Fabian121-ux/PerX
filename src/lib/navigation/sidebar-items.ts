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
  LayoutDashboard,
  Building2,
  Truck,
  Plane,
  Wrench,
  ShoppingBag,
  Wallet,
  ShieldCheck,
  LifeBuoy,
  Bookmark,
  BarChart3,
  UserCircle,
  ShieldAlert,
  Scale
} from "lucide-react";

export type SidebarGroup = "main" | "work" | "ecosystem" | "finance" | "support" | "account";

export type SidebarItem = {
  exact?: boolean;
  group: SidebarGroup;
  href: string;
  icon: LucideIcon;
  label: string;
};

export const sidebarItems: SidebarItem[] = [
  // Main
  {
    exact: true,
    group: "main",
    href: "/app",
    icon: Home,
    label: "Home",
  },
  {
    group: "main",
    href: "/app/dashboard",
    icon: LayoutDashboard,
    label: "Dashboard",
  },
  {
    group: "main",
    href: "/app/discover",
    icon: Store,
    label: "Discover",
  },

  // Network and work
  {
    group: "work",
    href: "/app/network",
    icon: UsersRound,
    label: "Network / Friends",
  },
  {
    group: "work",
    href: "/app/opportunities",
    icon: BriefcaseBusiness,
    label: "Opportunities",
  },
  {
    group: "work",
    href: "/app/proposals",
    icon: ClipboardList,
    label: "Proposals",
  },
  {
    group: "work",
    href: "/app/deals",
    icon: Handshake,
    label: "Agreements",
  },

  // Ecosystem
  {
    group: "ecosystem",
    href: "/app/real-estate",
    icon: Building2,
    label: "Real Estate",
  },
  {
    group: "ecosystem",
    href: "/app/logistics",
    icon: Truck,
    label: "Logistics",
  },
  {
    group: "ecosystem",
    href: "/app/travel-stay",
    icon: Plane,
    label: "Travel & Stay",
  },
  {
    group: "ecosystem",
    href: "/app/services",
    icon: Wrench,
    label: "Services",
  },
  {
    group: "ecosystem",
    href: "/app/market",
    icon: ShoppingBag,
    label: "Market",
  },

  // Trust and finance
  {
    group: "finance",
    href: "/app/wallet",
    icon: Wallet,
    label: "Wallet",
  },
  {
    group: "finance",
    href: "/app/escrow",
    icon: Scale,
    label: "Escrow",
  },
  {
    group: "finance",
    href: "/app/trust",
    icon: ShieldCheck,
    label: "Trust",
  },

  // Support
  {
    group: "support",
    href: "/app/service-center",
    icon: LifeBuoy,
    label: "Service Center",
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
    href: "/app/saved",
    icon: Bookmark,
    label: "Saved",
  },
  {
    group: "support",
    href: "/app/reports",
    icon: BarChart3,
    label: "Reports",
  },
  {
    group: "support",
    href: "/app/settings",
    icon: Settings,
    label: "Settings",
  },

  // Account
  {
    group: "account",
    href: "/app/profile",
    icon: UserCircle,
    label: "Profile",
  },
  {
    group: "account",
    href: "/admin",
    icon: ShieldAlert,
    label: "Admin",
  },
];

export const sidebarGroups: Array<{ key: SidebarGroup; label: string }> = [
  { key: "main", label: "Main" },
  { key: "work", label: "Network and work" },
  { key: "ecosystem", label: "Ecosystem" },
  { key: "finance", label: "Trust and finance" },
  { key: "support", label: "Support" },
  { key: "account", label: "Account" },
];

export function isSidebarItemActive(pathname: string, item: SidebarItem) {
  if (item.exact) {
    return pathname === item.href;
  }

  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
