import type { LucideIcon } from "lucide-react";

import {
  hasCapability,
  type Capability,
  type RoleName,
} from "@/lib/permissions/capabilities";
import {
  BarChart3,
  Bell,
  Bookmark,
  BriefcaseBusiness,
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
  /**
   * Preferred gate. Derives visibility from the same capability the
   * destination enforces, so navigation cannot drift out of sync with the
   * server-side authorization it advertises.
   */
  requiredCapability?: Capability;
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
    // `/app/network` and `/app/people` are redirect shims kept for existing
    // links; both must keep this item highlighted while the redirect resolves.
    activePaths: [getAppRoute("network"), "/app/people"],
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
    // Visibility is derived from the capability the destination actually
    // enforces (`opportunity:create` in
    // `src/app/app/opportunities/new/page.tsx`) rather than a duplicated role
    // list. The two had drifted apart, which is why Create was missing from
    // the mobile bar for every role without that capability.
    requiredCapability: "opportunity:create",
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
  // The "Real Estate" vertical was retired from the product experience.
  // It is intentionally absent from the registry, which removes it from the
  // sidebar, the feature directory, in-app search, and the preview shell in
  // one place. The underlying `PROPERTY` data and the admin moderation console
  // are deliberately retained - see docs/implementation/REAL_ESTATE_RETIREMENT.md.
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

export type MobileNavigationItem = {
  /** Extra paths that should keep this destination highlighted. */
  activePaths?: readonly string[];
  featureId: FeatureId;
  /** Overrides the registry label where the bottom bar needs a shorter word. */
  label?: string;
  /** Rendered as the raised centre action rather than a flat tab. */
  prominent?: boolean;
};

/**
 * The five primary mobile destinations, in visual left-to-right order.
 *
 *   Home | Network | Create | Messages | Profile
 *
 * Home leads because the authenticated experience is feed-first. Create is the
 * prominent centre action: it is the single most common intentional act and it
 * opens a full-screen composer, so it reads as an action rather than a tab.
 *
 * Labels are overridden here rather than in the registry because the sidebar
 * and feature directory have room for the longer, more descriptive names
 * ("Connections", "Create Post") while the bottom bar does not.
 */
export const authenticatedMobileNavigation = [
  { featureId: "home", label: "Home" },
  {
    // Discovery is the natural sibling of connections on mobile, where there
    // is no sidebar to reach it from, so the tab covers both surfaces.
    activePaths: [getAppRoute("discover"), getAppRoute("network"), "/app/people"],
    featureId: "connections",
    label: "Network",
  },
  { featureId: "create-post", label: "Create", prominent: true },
  { featureId: "messages", label: "Messages" },
  { featureId: "profile", label: "Profile" },
] as const satisfies readonly MobileNavigationItem[];

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
  feature: Pick<FeatureDefinition, "requiredCapability" | "requiredRoles">,
  roles: readonly string[] = [],
) {
  if (feature.requiredCapability) {
    return hasCapability(roles as RoleName[], feature.requiredCapability);
  }
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
