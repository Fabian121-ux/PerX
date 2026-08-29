"use client";

import { useEffect } from "react";

import { ErrorState } from "@/components/system/error-state";
import { classifyError } from "@/lib/errors/taxonomy";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Structured, safe: route/kind/digest only. The underlying message stays
    // server side, so no database URL, token or raw SQL can reach a browser.
    console.error("[perx:error-boundary]", {
      digest: error.digest,
      kind: classifyError(error),
      route: "/app",
      timestamp: new Date().toISOString(),
    });
  }, [error]);

  // The previous copy claimed "this is typically due to a temporary connection
  // issue" for every failure, including server errors that had nothing to do
  // with connectivity. The taxonomy now decides what is actually claimed.
  return <ErrorState error={error} onRetry={reset} surface="your workspace" />;
}
