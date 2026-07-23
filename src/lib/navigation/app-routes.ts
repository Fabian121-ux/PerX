export type AppEnvironment = "app" | "preview";

export type RouteKey =
  | "home"
  | "network"
  | "real_estate"
  | "logistics"
  | "travel_stay"
  | "services"
  | "market"
  | "wallet"
  | "escrow"
  | "service_center"
  | "reports"
  | "discover"
  | "profile"
  | "opportunities"
  | "new_opportunity"
  | "saved"
  | "proposals_sent"
  | "proposals_received"
  | "messages"
  | "deals"
  | "reviews"
  | "notifications"
  | "settings"
  | "startups";

const routeMap: Record<RouteKey, string> = {
  home: "/app",
  network: "/app/network",
  real_estate: "/app/real-estate",
  logistics: "/app/logistics",
  travel_stay: "/app/travel-stay",
  services: "/app/services",
  market: "/app/market",
  wallet: "/app/wallet",
  escrow: "/app/escrow",
  service_center: "/app/service-center",
  reports: "/app/reports",
  discover: "/app/discover",
  profile: "/app/profile/edit",
  opportunities: "/app/opportunities",
  new_opportunity: "/app/opportunities/new",
  saved: "/app/saved",
  proposals_sent: "/app/proposals/sent",
  proposals_received: "/app/proposals/received",
  messages: "/app/messages",
  deals: "/app/deals",
  reviews: "/app/reviews",
  notifications: "/app/notifications",
  settings: "/app/settings",
  startups: "/app/discover?type=STARTUP",
};

/**
 * Resolves an internal application route based on the current environment.
 * Prevents authenticated users from accidentally navigating to public pages (e.g. public /discover)
 * and ensures preview users stay within the /preview shell.
 */
export function getAppRoute(
  key: RouteKey,
  environment: AppEnvironment = "app",
): string {
  if (environment === "preview") {
    if (key === "home") return "/preview";
    if (key === "deals") return "/preview/deals/demo-deal";
    if (key === "profile") return "/preview/profile";

    const path = routeMap[key];
    return `/preview${path.startsWith("/app/") ? path.slice(4) : path}`;
  }

  return routeMap[key];
}

/**
 * Helper to determine if a path is within the preview environment.
 */
export function isPreviewPath(pathname: string): boolean {
  return pathname.startsWith("/preview");
}

/**
 * Helper to get the current environment from a pathname.
 */
export function getEnvironment(pathname: string): AppEnvironment {
  return isPreviewPath(pathname) ? "preview" : "app";
}
