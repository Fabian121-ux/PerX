/**
 * Error taxonomy for user-facing failure surfaces.
 *
 * The problem this solves: every `error.tsx` boundary previously asserted a
 * cause it had not established - most visibly "this is typically due to a
 * temporary connection issue" on a route that had actually returned a 500 from
 * server code. Telling a user their network is broken when the server threw is
 * both wrong and unactionable.
 *
 * A React error boundary receives very little: in production Next.js strips the
 * message and leaves a `digest`. So classification is deliberately
 * conservative - when the evidence does not identify a cause, the honest answer
 * is UNKNOWN, whose copy makes no claim about why.
 */

export type ErrorKind =
  | "AUTH_REQUIRED"
  | "FEATURE_GATE"
  | "NOT_FOUND"
  | "VALIDATION"
  | "CONFLICT"
  | "RATE_LIMIT"
  | "NETWORK"
  | "TIMEOUT"
  | "DEPENDENCY_FAILURE"
  | "SERVER_ERROR"
  | "UNKNOWN";

export type ErrorPresentation = {
  /** Whether retrying could plausibly change the outcome. */
  canRetry: boolean;
  description: string;
  kind: ErrorKind;
  title: string;
};

/** Browser-side signals that genuinely indicate a transport failure. */
const NETWORK_PATTERNS = [
  "failed to fetch",
  "networkerror",
  "network request failed",
  "load failed",
  "err_internet_disconnected",
  "err_network",
  "err_connection",
  "connection refused",
  "econnrefused",
  "enotfound",
  "socket hang up",
];

const TIMEOUT_PATTERNS = [
  "timeout",
  "timed out",
  "etimedout",
  "deadline exceeded",
];

const AUTH_PATTERNS = [
  "authentication required",
  "unauthenticated",
  "session expired",
  "not signed in",
];

const GATE_PATTERNS = [
  "forbidden",
  "not authorized",
  "unauthorized",
  "access denied",
  "capability",
];

const NOT_FOUND_PATTERNS = ["not found", "no such", "does not exist"];

const CONFLICT_PATTERNS = [
  "conflict",
  "already exists",
  "unique constraint",
  "version mismatch",
];

const RATE_LIMIT_PATTERNS = ["rate limit", "too many requests", "throttled"];

const DEPENDENCY_PATTERNS = [
  "upstream",
  "bad gateway",
  "service unavailable",
  "supabase",
  "storage",
];

function matches(haystack: string, patterns: readonly string[]) {
  return patterns.some((pattern) => haystack.includes(pattern));
}

/**
 * Classifies an error using only evidence actually present on it.
 *
 * Order matters: the most specific and least ambiguous signals are checked
 * first, and NETWORK is checked before the generic server buckets because a
 * fetch failure is the one cause a client can identify with confidence.
 */
export function classifyError(error: unknown): ErrorKind {
  if (!error) return "UNKNOWN";

  const status =
    typeof error === "object" && error !== null && "status" in error
      ? Number((error as { status?: unknown }).status)
      : undefined;

  if (typeof status === "number" && Number.isFinite(status)) {
    if (status === 401) return "AUTH_REQUIRED";
    if (status === 403) return "FEATURE_GATE";
    if (status === 404) return "NOT_FOUND";
    if (status === 409) return "CONFLICT";
    if (status === 422 || status === 400) return "VALIDATION";
    if (status === 429) return "RATE_LIMIT";
    if (status === 502 || status === 503) return "DEPENDENCY_FAILURE";
    if (status === 504) return "TIMEOUT";
    if (status >= 500) return "SERVER_ERROR";
  }

  const name = error instanceof Error ? error.name.toLowerCase() : "";
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  const haystack = `${name} ${message}`.trim();

  if (!haystack) return "UNKNOWN";

  if (name === "aborterror") return "TIMEOUT";
  if (matches(haystack, TIMEOUT_PATTERNS)) return "TIMEOUT";
  if (matches(haystack, NETWORK_PATTERNS)) return "NETWORK";
  if (matches(haystack, AUTH_PATTERNS)) return "AUTH_REQUIRED";
  if (matches(haystack, GATE_PATTERNS)) return "FEATURE_GATE";
  if (matches(haystack, NOT_FOUND_PATTERNS)) return "NOT_FOUND";
  if (matches(haystack, CONFLICT_PATTERNS)) return "CONFLICT";
  if (matches(haystack, RATE_LIMIT_PATTERNS)) return "RATE_LIMIT";
  if (matches(haystack, DEPENDENCY_PATTERNS)) return "DEPENDENCY_FAILURE";

  return "UNKNOWN";
}

/**
 * Copy for each kind.
 *
 * `surface` names the area so a boundary can say what failed without inventing
 * a reason. Nothing here speculates about connectivity unless the error
 * actually evidenced a transport failure.
 */
export function describeError(
  kind: ErrorKind,
  surface = "this section",
): ErrorPresentation {
  switch (kind) {
    case "AUTH_REQUIRED":
      return {
        canRetry: false,
        description: "Your session has ended. Sign in again to continue.",
        kind,
        title: "Sign in to continue",
      };
    case "FEATURE_GATE":
      return {
        canRetry: false,
        description: "This account does not have access to this area.",
        kind,
        title: "Access unavailable",
      };
    case "NOT_FOUND":
      return {
        canRetry: false,
        description: "This item may have been moved or removed.",
        kind,
        title: "Not found",
      };
    case "VALIDATION":
      return {
        canRetry: false,
        description: "Some details need attention before this can continue.",
        kind,
        title: "Check the highlighted details",
      };
    case "CONFLICT":
      return {
        canRetry: true,
        description: "This changed somewhere else. Reload to see the latest.",
        kind,
        title: "This was updated elsewhere",
      };
    case "RATE_LIMIT":
      return {
        canRetry: true,
        description: "Too many attempts. Wait a moment and try again.",
        kind,
        title: "Slow down for a moment",
      };
    case "NETWORK":
      return {
        canRetry: true,
        description: "Check your connection, then retry.",
        kind,
        title: "You appear to be offline",
      };
    case "TIMEOUT":
      return {
        canRetry: true,
        description: "This took too long to respond. Try again.",
        kind,
        title: "That took too long",
      };
    case "DEPENDENCY_FAILURE":
      return {
        canRetry: true,
        description:
          "A service PerX depends on is not responding. Try again shortly.",
        kind,
        title: "A dependency is unavailable",
      };
    case "SERVER_ERROR":
      return {
        canRetry: true,
        description: `Something went wrong on our side while loading ${surface}.`,
        kind,
        title: "Something went wrong",
      };
    default:
      // No claim about the cause: the boundary genuinely does not know.
      return {
        canRetry: true,
        description: `We couldn't load ${surface}.`,
        kind: "UNKNOWN",
        title: "We couldn't load this",
      };
  }
}

export function presentError(
  error: unknown,
  surface?: string,
): ErrorPresentation {
  return describeError(classifyError(error), surface);
}
