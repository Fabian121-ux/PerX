/**
 * Routes that take over the whole screen on mobile.
 *
 * An "immersive" route replaces the app chrome (topbar, bottom navigation)
 * with its own focused header/footer, so the user's attention stays on a
 * single task. Kept as pure predicates so the rules are unit-testable and so
 * `AppShell` does not accumulate ad-hoc pathname regexes.
 */

export type ImmersiveKind =
  /** Full-screen at every breakpoint - the composer owns the viewport. */
  | "distraction-free"
  /** Full-screen on mobile only; desktop keeps the split-pane layout. */
  | "mobile-conversation"
  | null;

/** `/app/messages/<id>` - a single open conversation, not the inbox list. */
const CONVERSATION_PATTERN = /^\/app\/messages\/[^/]+$/;

/**
 * Composer routes. These are full-screen at all breakpoints because the
 * composer is a focused create/edit workflow with its own action bar.
 */
const DISTRACTION_FREE_PATTERNS: readonly RegExp[] = [
  /^\/app\/opportunities\/new$/,
  /^\/app\/opportunities\/[^/]+\/edit$/,
];

export function isDistractionFreeRoute(pathname: string): boolean {
  return DISTRACTION_FREE_PATTERNS.some((pattern) => pattern.test(pathname));
}

export function isMobileConversationRoute(pathname: string): boolean {
  return CONVERSATION_PATTERN.test(pathname);
}

export function isImmersiveRoute(pathname: string): ImmersiveKind {
  if (isDistractionFreeRoute(pathname)) return "distraction-free";
  if (isMobileConversationRoute(pathname)) return "mobile-conversation";
  return null;
}
