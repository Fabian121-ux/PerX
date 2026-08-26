/**
 * Clear browser state that belongs to the signed-in account.
 *
 * PreX caches authenticated UI in the browser (home feed snapshot, message
 * drafts, conversation filters, composer drafts). On a shared device those are
 * private to the account that produced them, so signing out must remove them -
 * otherwise the next person to sign in on the same browser can read the
 * previous user's cached feed and drafts.
 *
 * Deliberately scoped: only the `perx:` namespace used by authenticated
 * features is removed. Device preferences that are not account data - theme,
 * for example - are left alone, because wiping them would be a surprising
 * side effect of signing out.
 */
const AUTHENTICATED_KEY_PREFIXES = [
  "perx:home-feed",
  "perx:messages:",
  "perx:opportunity-composer:",
] as const;

function isAuthenticatedKey(key: string) {
  return AUTHENTICATED_KEY_PREFIXES.some((prefix) => key.startsWith(prefix));
}

function purge(storage: Storage | undefined) {
  if (!storage) return;
  try {
    // Collect first: removing during iteration reindexes the store.
    const doomed: string[] = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key && isAuthenticatedKey(key)) doomed.push(key);
    }
    for (const key of doomed) storage.removeItem(key);
  } catch {
    // Private-mode and quota-restricted browsers can throw on access; sign-out
    // must still proceed, and the server session is the real authority.
  }
}

/**
 * Set once sign-out begins.
 *
 * Components that persist authenticated state on unmount (the home feed writes
 * its snapshot in an unmount effect) would otherwise re-create the cache
 * immediately after it is purged, as the router navigates away to the sign-in
 * page. Callers check this before writing.
 */
let signingOut = false;

export function isSigningOut() {
  return signingOut;
}

/**
 * Re-enable authenticated caching.
 *
 * Sign-out routes to the sign-in page via a client-side navigation, so this
 * module is not re-evaluated and the flag would otherwise stay set for the life
 * of the tab - silently disabling feed scroll restore for whoever signs in
 * next. Authenticated surfaces call this on mount, which can only happen once a
 * session exists again.
 */
export function markAuthenticatedSessionActive() {
  signingOut = false;
}

export function clearAuthenticatedClientState() {
  if (typeof window === "undefined") return;
  signingOut = true;
  purge(window.sessionStorage);
  purge(window.localStorage);
}
