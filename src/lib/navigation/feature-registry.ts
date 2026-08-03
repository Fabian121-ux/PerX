import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Bell,
  Bookmark,
  BriefcaseBusiness,
  Building2,
  ClipboardList,
  Compass,
  FileText,
  Handshake,
  Home,
  LifeBuoy,
  MessageSquare,
  Newspaper,
  Plane,
  Scale,
  Settings,
  ShieldAlert,
  ShieldCheck,
  ShoppingBag,
  SquarePen,
  Truck,
  UserCircle,
  UsersRound,
  Wallet,
  Wrench,
} from "lucide-react";

import { getAppRoute } from "@/lib/navigation/app-routes";

export const featureGroups = [
  { id: "main", label: "Start here" },
  { id: "work", label: "Connections and work" },
  { id: "ecosystem", label: "Services and ecosystem" },
  { id: "finance", label: "Trust and finance" },
  { id: "support", label: "Support and updates" },
  { id: "account", label: "Account" },
] as const;

export type FeatureGroupId = (typeof featureGroups)[number]["id"];

export type FeatureStatus = {
  kind: "beta" | "simulated";
  label: string;
};

export type FeatureDefinition = {
  activePaths?: readonly string[];
  description: string;
  exact?: boolean;
  group: FeatureGroupId;
  href: string;
  icon: LucideIcon;
  id: string;
  keywords: readonly string[];
  label: string;
  requiredRoles?: readonly string[];
  showInSidebar?: boolean;
  status?: FeatureStatus;
};

export const featureRegistry = [
  {
    description: "Your authenticated PerX overview and activity hub.",
    exact: true,
    group: "main",
    href: getAppRoute("home"),
    icon: Home,
    id: "home",
    keywords: ["dashboard", "overview", "start"],
    label: "Home",
    showInSidebar: true,
  },
  {
    description: "Search opportunities, people, businesses, and services.",
    group: "main",
    href: getAppRoute("discover"),
    icon: Compass,
    id: "discover",
    keywords: ["search", "explore", "find"],
    label: "Discover",
    showInSidebar: true,
  },
  {
    description: "Find people and view professional profiles.",
    group: "work",
    href: getAppRoute("people"),
    icon: UsersRound,
    id: "people",
    keywords: ["members", "profiles", "network"],
    label: "People",
    showInSidebar: true,
  },
  {
    activePaths: [getAppRoute("network")],
    description: "Manage connections, requests, and suggestions.",
    group: "work",
    href: getAppRoute("connections"),
    icon: UsersRound,
    id: "connections",
    keywords: ["network", "requests", "contacts", "pending"],
    label: "Connections",
    showInSidebar: true,
  },
  {
    description: "Publish an opportunity, service, partnership, or listing.",
    group: "work",
    href: getAppRoute("create_post"),
    icon: SquarePen,
    id: "create-post",
    keywords: ["new", "publish", "listing", "opportunity", "content"],
    label: "Create Post",
  },
  {
    description: "Review your drafts and published posts.",
    group: "work",
    href: getAppRoute("manage"),
    icon: ClipboardList,
    id: "manage-posts",
    keywords: ["content", "drafts", "published", "listings"],
    label: "Manage Posts",
    showInSidebar: true,
  },
  {
    description: "Browse and manage work and collaboration opportunities.",
    group: "work",
    href: getAppRoute("opportunities"),
    icon: BriefcaseBusiness,
    id: "opportunities",
    keywords: ["work", "projects", "jobs", "listings"],
    label: "Opportunities",
    showInSidebar: true,
  },
  {
    description: "Review proposals you have sent and received.",
    group: "work",
    href: getAppRoute("proposals"),
    icon: FileText,
    id: "proposals",
    keywords: ["offers", "sent", "received", "applications"],
    label: "Proposals",
    showInSidebar: true,
  },
  {
    description: "Track accepted work and active agreements.",
    group: "work",
    href: getAppRoute("deals"),
    icon: Handshake,
    id: "deals",
    keywords: ["agreements", "contracts", "milestones"],
    label: "Deals",
    showInSidebar: true,
  },
  {
    description: "Explore property opportunities and listings.",
    group: "ecosystem",
    href: getAppRoute("real_estate"),
    icon: Building2,
    id: "real-estate",
    keywords: ["property", "housing", "buildings"],
    label: "Real Estate",
    showInSidebar: true,
  },
  {
    description: "Explore logistics-related opportunities and providers.",
    group: "ecosystem",
    href: getAppRoute("logistics"),
    icon: Truck,
    id: "logistics",
    keywords: ["delivery", "shipping", "transport"],
    label: "Logistics",
    showInSidebar: true,
  },
  {
    description: "Explore travel and accommodation opportunities.",
    group: "ecosystem",
    href: getAppRoute("travel_stay"),
    icon: Plane,
    id: "travel-stay",
    keywords: ["travel", "stay", "accommodation"],
    label: "Travel & Stay",
    showInSidebar: true,
  },
  {
    description: "Find professional services and service opportunities.",
    group: "ecosystem",
    href: getAppRoute("services"),
    icon: Wrench,
    id: "services",
    keywords: ["skills", "providers", "freelance"],
    label: "Services",
    showInSidebar: true,
  },
  {
    description: "Browse marketplace listings and opportunities.",
    group: "ecosystem",
    href: getAppRoute("market"),
    icon: ShoppingBag,
    id: "market",
    keywords: ["marketplace", "listings", "browse"],
    label: "Market",
    showInSidebar: true,
  },
  {
    description: "Review informational wallet activity available in beta.",
    group: "finance",
    href: getAppRoute("wallet"),
    icon: Wallet,
    id: "wallet",
    keywords: ["finance", "activity", "money"],
    label: "Wallet",
    showInSidebar: true,
    status: { kind: "beta", label: "Beta information" },
  },
  {
    description:
      "Transaction protection is not yet available and is being prepared.",
    group: "finance",
    href: getAppRoute("escrow"),
    icon: Scale,
    id: "escrow",
    keywords: ["escrow", "transaction protection", "being prepared"],
    label: "Escrow",
    showInSidebar: true,
  },
  {
    description: "Review trust signals, verification, and platform guidance.",
    group: "finance",
    href: getAppRoute("trust"),
    icon: ShieldCheck,
    id: "trust",
    keywords: ["safety", "verification", "reputation"],
    label: "Trust",
    showInSidebar: true,
  },
  {
    description: "Open and review support requests.",
    group: "support",
    href: getAppRoute("service_center"),
    icon: LifeBuoy,
    id: "support",
    keywords: ["help", "tickets", "service center"],
    label: "Service Center",
    showInSidebar: true,
  },
  {
    description: "Open your conversations and message requests.",
    group: "support",
    href: getAppRoute("messages"),
    icon: MessageSquare,
    id: "messages",
    keywords: ["chat", "inbox", "conversations"],
    label: "Messages",
    showInSidebar: true,
  },
  {
    description: "Read official announcements and platform updates from PerX.",
    group: "support",
    href: getAppRoute("news"),
    icon: Newspaper,
    id: "news",
    keywords: ["announcements", "broadcasts", "official", "updates"],
    label: "News",
    showInSidebar: true,
  },
  {
    description: "Review personal account and workflow activity.",
    group: "support",
    href: getAppRoute("notifications"),
    icon: Bell,
    id: "notifications",
    keywords: ["notifications", "updates", "alerts", "activity"],
    label: "Activity",
    showInSidebar: true,
  },
  {
    description: "Return to people, posts, and listings you saved.",
    group: "support",
    href: getAppRoute("saved"),
    icon: Bookmark,
    id: "saved",
    keywords: ["bookmarks", "favorites", "later"],
    label: "Saved",
    showInSidebar: true,
  },
  {
    description: "Review safety and marketplace reports you submitted.",
    group: "support",
    href: getAppRoute("reports"),
    icon: BarChart3,
    id: "reports",
    keywords: ["moderation", "safety", "submitted"],
    label: "Reports",
    showInSidebar: true,
  },
  {
    description: "Manage your account, security, and preferences.",
    group: "support",
    href: getAppRoute("settings"),
    icon: Settings,
    id: "settings",
    keywords: ["account", "security", "preferences"],
    label: "Settings",
    showInSidebar: true,
  },
  {
    description: "View and manage your PerX identity.",
    group: "account",
    href: getAppRoute("profile"),
    icon: UserCircle,
    id: "profile",
    keywords: ["account", "identity", "edit profile"],
    label: "Profile",
    showInSidebar: true,
  },
  {
    description: "Open administrative operations.",
    group: "account",
    href: "/admin",
    icon: ShieldAlert,
    id: "admin",
    keywords: ["moderation", "operations"],
    label: "Admin",
    requiredRoles: ["ADMIN", "MASTER_ADMIN"],
    showInSidebar: true,
  },
] as const satisfies readonly FeatureDefinition[];

export type FeatureId = (typeof featureRegistry)[number]["id"];

export const authenticatedMobileNavigation = [
  { featureId: "connections" },
  { featureId: "create-post" },
  { featureId: "home", prominent: true },
  { featureId: "messages" },
  { featureId: "profile" },
] as const satisfies readonly {
  featureId: FeatureId;
  prominent?: boolean;
}[];

export const secondaryNavigation = [
  { featureId: "profile", label: "Account" },
  { featureId: "news", label: "News" },
  { featureId: "support", label: "Support" },
  { featureId: "settings", label: "Settings" },
] as const satisfies readonly {
  featureId: FeatureId;
  label: string;
}[];

export function canAccessFeature(
  feature: Pick<FeatureDefinition, "requiredRoles">,
  roles: readonly string[] = [],
) {
  if (!feature.requiredRoles?.length) return true;
  return feature.requiredRoles.some((role) => roles.includes(role));
}

export function getFeatureById(id: FeatureId): FeatureDefinition {
  const feature = (featureRegistry as readonly FeatureDefinition[]).find(
    (entry) => entry.id === id,
  );

  if (!feature) {
    throw new Error(`Unknown navigation feature: ${id}`);
  }

  return feature;
}

export function searchFeatures(
  query: string,
  options: { roles?: readonly string[] } = {},
): FeatureDefinition[] {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);

  return (featureRegistry as readonly FeatureDefinition[]).filter((feature) => {
    if (!canAccessFeature(feature, options.roles)) return false;
    if (!terms.length) return true;

    const searchableText = [
      feature.label,
      feature.description,
      ...feature.keywords,
      feature.status?.label ?? "",
    ]
      .join(" ")
      .toLocaleLowerCase();

    return terms.every((term) => searchableText.includes(term));
  });
}
