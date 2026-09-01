import { headers } from "next/headers";

/**
 * Opt-in fault injection for reliability testing.
 *
 * Feature-local failure isolation cannot be proven by reading code: something
 * has to actually throw, in a real request, and the route has to survive. This
 * provides that trigger without shipping a way to break production.
 *
 * Three independent conditions must all hold before a fault can fire:
 *
 *   1. `PERX_ENABLE_FAULT_INJECTION` is explicitly "true"
 *   2. `NODE_ENV` is not "production", OR `PERX_DEPLOY_ENV` is development/staging
 *   3. the request carries an `x-perx-fault` header naming the surface
 *
 * A production deployment satisfies none of them, and the environment variable
 * is absent from every committed env file. The header is per-request, so an
 * injected fault cannot leak into another user's traffic.
 */

function faultInjectionAllowed() {
  if (process.env.PERX_ENABLE_FAULT_INJECTION !== "true") return false;
  const deployEnv = process.env.PERX_DEPLOY_ENV;
  if (process.env.NODE_ENV === "production") {
    // Allowed only when the deployment explicitly declares itself non-production
    // (the local production-mode server used for reliability measurement).
    return deployEnv === "development" || deployEnv === "staging";
  }
  return true;
}

/**
 * Throws when the current request asks this named surface to fail.
 *
 * Call at the top of an optional data path. `surface` is a stable identifier
 * such as "profile-activity" or "message-profile-preview".
 */
export async function maybeInjectFault(surface: string) {
  if (!faultInjectionAllowed()) return;
  let requested: string | null = null;
  try {
    requested = (await headers()).get("x-perx-fault");
  } catch {
    // Outside a request scope (e.g. build-time evaluation): never inject.
    return;
  }
  if (!requested) return;
  const targets = requested
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (targets.includes(surface)) {
    throw new Error(`Injected fault: ${surface}`);
  }
}
