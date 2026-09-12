"use client";

import { useEffect } from "react";

import { ErrorState } from "@/components/system/error-state";
import { classifyError } from "@/lib/errors/taxonomy";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Structured, safe: route/kind/digest only. Previously the whole error
    // object was logged here, which is both inconsistent with the app segment
    // and a way for connection strings and raw SQL to reach a browser console.
    console.error("[perx:error-boundary]", {
      digest: error.digest,
      kind: classifyError(error),
      route: "/admin",
      timestamp: new Date().toISOString(),
    });
  }, [error]);

  /**
   * The previous copy said "Secure administration tools are currently offline.
   * Check connection logs." for every failure. The outage it was shown during
   * was a missing table - a schema fault with no connectivity component - so it
   * pointed operators at the wrong system for 15 days.
   *
   * The taxonomy now decides what is claimed, and `ErrorState` renders retry
   * only when `canRetry` holds. That is what ends the retry loop: reset()
   * re-runs the same failing render, so a SERVER_ERROR or DEPENDENCY_FAILURE
   * no longer offers a button that cannot change the outcome.
   *
   * `homeHref="/admin"` keeps a signed-in operator inside the portal rather
   * than ejecting them to the public root.
   */
  return (
    <ErrorState
      error={error}
      homeHref="/admin"
      homeLabel="Back to admin"
      onRetry={reset}
      surface="the admin portal"
    />
  );
}
