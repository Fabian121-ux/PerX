/**
 * Single source of truth for where an authenticated visitor "lands".
 *
 * Used by:
 * - `/` (marketing page) to bounce signed-in visitors straight to the product
 * - the PWA manifest `start_url`, so an installed app never opens on marketing
 * - auth pages, as the default post-sign-in destination
 *
 * Keeping one constant prevents the marketing page, the manifest and the auth
 * redirect helper from drifting apart, which is what previously allowed an
 * installed PWA to cold-start on the public landing page.
 */
export const AUTHENTICATED_HOME_PATH = "/app";

/**
 * Query flag appended to the installed-app `start_url`.
 *
 * The manifest cannot point directly at `/app`: an unauthenticated (or
 * signed-out) install would then cold-start into a `/sign-in` redirect chain
 * and lose the launch context. Instead the installed app starts at `/` with
 * this marker, and `/` resolves the correct destination server-side:
 *
 *   authenticated  -> /app
 *   unauthenticated -> marketing page (normal public flow, unchanged)
 */
export const PWA_LAUNCH_PARAM = "source";
export const PWA_LAUNCH_VALUE = "pwa";

export const PWA_START_URL = `/?${PWA_LAUNCH_PARAM}=${PWA_LAUNCH_VALUE}`;

/**
 * True when the current request came from an installed app launch.
 * Only used for analytics/entry decisions - never for authorization.
 */
export function isPwaLaunch(
  searchParams: Record<string, string | string[] | undefined> | undefined,
): boolean {
  const value = searchParams?.[PWA_LAUNCH_PARAM];
  return Array.isArray(value)
    ? value.includes(PWA_LAUNCH_VALUE)
    : value === PWA_LAUNCH_VALUE;
}
