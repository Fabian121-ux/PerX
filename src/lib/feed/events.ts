/**
 * Feed interaction hooks - Batch 8 preparation.
 *
 * Batch 8 will build recommendation ranking, which needs behavioural signal.
 * Rather than retrofitting call sites across the feed later, the signal points
 * are named now and routed through one function.
 *
 * This intentionally does NOT persist anything. There is no event table, no
 * batching, no transport, and no scalable retention design yet - and shipping
 * a high-volume write path without those would be worse than shipping nothing.
 * The default sink is a no-op, so today this costs one function call.
 *
 * Batch 8 replaces `setFeedEventSink` with a real implementation and must
 * define: schema, sampling, batching, retention, privacy/consent, and opt-out.
 */

export type FeedEventName =
  /** A post occupied a meaningful portion of the viewport. Sampled, never per-scroll. */
  | "post_impression"
  /** The viewer opened a post detail page from the feed. */
  | "post_open"
  /** The viewer opened an author's profile from a feed card. */
  | "profile_open"
  /** The viewer saved or unsaved a post from the feed. */
  | "post_save"
  /**
   * Reserved. Reactions and comments do not exist in the schema yet and are
   * deferred by `docs/architecture/PERX_B3_PRESENTATION_AND_B4_BOUNDARIES.md`.
   * Named here so Batch 8 does not redefine the vocabulary.
   */
  | "post_react"
  | "post_comment";

export type FeedEvent = {
  name: FeedEventName;
  /** Opportunity id. */
  postId: string;
  /** Feed slot, 0-based. Position bias is a required ranking input. */
  position?: number;
  /** Which half of the stream produced the post. */
  segment?: "network" | "discovery";
};

type FeedEventSink = (event: FeedEvent) => void;

/**
 * No-op default. Feed instrumentation must never affect rendering, so the sink
 * is deliberately incapable of failing loudly or blocking.
 */
let sink: FeedEventSink = () => {};

export function setFeedEventSink(next: FeedEventSink | null) {
  sink = next ?? (() => {});
}

export function recordFeedEvent(event: FeedEvent) {
  try {
    sink(event);
  } catch {
    // Analytics must never break the feed.
  }
}

/**
 * Impression de-duplication.
 *
 * A post crossing the viewport threshold repeatedly (scroll up, scroll down)
 * is one impression, not many. Callers keep a Set per feed session.
 */
export function markImpression(seen: Set<string>, postId: string) {
  if (seen.has(postId)) return false;
  seen.add(postId);
  return true;
}
