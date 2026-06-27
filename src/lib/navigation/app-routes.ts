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
  home: "/dashboard",
  network: "/network",
  real_estate: "/real-estate",
  logistics: "/logistics",
  travel_stay: "/travel-stay",
  services: "/services",
  market: "/market",
  wallet: "/wallet",
  escrow: "/escrow",
  service_center: "/service-center",
  reports: "/reports",
  discover: "/market",
  profile: "/profile/edit",
  opportunities: "/market",
  new_opportunity: "/opportunities/new",
  saved: "/saved",
  proposals_sent: "/proposals/sent",
  proposals_received: "/proposals/received",
  messages: "/messages",
  deals: "/deals",
  reviews: "/reviews",
  notifications: "/notifications",
  settings: "/settings",
  startups: "/market?type=STARTUP",
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
    return `/preview${path}`;
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
