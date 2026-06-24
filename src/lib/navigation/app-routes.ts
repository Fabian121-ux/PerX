export type AppEnvironment = "app" | "preview";

export type RouteKey =
  | "home"
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
  | "startups"
  | "network";

const routeMap: Record<RouteKey, string> = {
  home: "",
  discover: "/discover",
  profile: "/profile/edit",
  opportunities: "/opportunities",
  new_opportunity: "/opportunities/new",
  saved: "/saved",
  proposals_sent: "/proposals/sent",
  proposals_received: "/proposals/received",
  messages: "/messages",
  deals: "/deals",
  reviews: "/reviews",
  notifications: "/notifications",
  settings: "/settings",
  startups: "/discover?type=STARTUP",
  network: "/discover?type=PEOPLE",
};

/**
 * Resolves an internal application route based on the current environment.
 * Prevents authenticated users from accidentally navigating to public pages (e.g. public /discover)
 * and ensures preview users stay within the /preview shell.
 */
export function getAppRoute(key: RouteKey, environment: AppEnvironment = "app"): string {
  if (environment === "preview" && key === "deals") {
    return "/preview/deals/demo-deal";
  }

  const path = routeMap[key];
  return `/${environment}${path}`;
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
