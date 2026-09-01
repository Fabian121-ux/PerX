/**
 * Degraded-mode polling schedule for messaging.
 *
 * When Supabase Realtime is unavailable the workspace falls back to polling
 * `/api/messages/sync`. A fixed 5s interval was measured at up to ~12
 * requests/min and ~940 KB/min for a single open conversation, which is far too
 * expensive to sustain for a prolonged outage.
 *
 * The schedule is a small pure function so the policy can be unit tested
 * without a browser, a server, or a real outage.
 *
 * Shape of the policy:
 *   - HIDDEN tabs do not poll at all.
 *   - The first few degraded ticks stay responsive, because most Realtime
 *     interruptions are short and the user is usually still reading.
 *   - A continuing outage backs off geometrically to a bounded ceiling.
 *   - Recent user activity (sending, typing, switching threads) temporarily
 *     restores the responsive interval.
 */

export type FallbackActivity = "active" | "hidden" | "idle";

/** Responsive interval used for early ticks and recently active threads. */
export const FALLBACK_ACTIVE_MS = 5_000;
/** Ceiling for a sustained outage on an idle thread. */
export const FALLBACK_MAX_MS = 60_000;
/** Ticks served at the responsive interval before backoff starts. */
export const FALLBACK_RESPONSIVE_TICKS = 3;
/** How long user interaction keeps a conversation "active". */
export const FALLBACK_ACTIVITY_WINDOW_MS = 30_000;

/**
 * Next delay before another degraded reconciliation.
 *
 * `null` means "do not schedule" - used for hidden tabs, where polling a
 * background document wastes the user's data for output nobody can see.
 */
export function getFallbackDelayMs({
  activity,
  consecutiveFailures,
}: {
  activity: FallbackActivity;
  /** Degraded ticks already served since Realtime was last healthy. */
  consecutiveFailures: number;
}): number | null {
  if (activity === "hidden") return null;

  const ticks = Math.max(0, consecutiveFailures);

  // Recently active conversations stay responsive: the user is plausibly
  // waiting on a reply right now.
  if (activity === "active") return FALLBACK_ACTIVE_MS;

  if (ticks < FALLBACK_RESPONSIVE_TICKS) return FALLBACK_ACTIVE_MS;

  const backoff =
    FALLBACK_ACTIVE_MS * 2 ** (ticks - FALLBACK_RESPONSIVE_TICKS + 1);
  return Math.min(FALLBACK_MAX_MS, backoff);
}

/** Classifies the conversation for scheduling purposes. */
export function getFallbackActivity({
  documentVisible,
  lastInteractionAt,
  now = Date.now(),
}: {
  documentVisible: boolean;
  /** Epoch ms of the last meaningful user interaction, or null. */
  lastInteractionAt: number | null;
  now?: number;
}): FallbackActivity {
  if (!documentVisible) return "hidden";
  if (
    lastInteractionAt !== null &&
    now - lastInteractionAt <= FALLBACK_ACTIVITY_WINDOW_MS
  ) {
    return "active";
  }
  return "idle";
}

/**
 * How long the stream must stay healthy before degraded backoff is reset.
 *
 * The SSE route retries its own Realtime subscription during an outage and
 * emits a reconciliation whenever an attempt briefly succeeds. Without this
 * grace window each of those looked like full recovery, cleared the backoff,
 * and kept a flapping outage polling at the responsive interval.
 */
export const FALLBACK_RECOVERY_GRACE_MS = 20_000;
