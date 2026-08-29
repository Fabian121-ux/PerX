"use client";

import { useEffect } from "react";

import { ErrorState } from "@/components/system/error-state";
import { classifyError } from "@/lib/errors/taxonomy";

export default function MessagesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[perx:error-boundary]", {
      digest: error.digest,
      kind: classifyError(error),
      route: "/app/messages",
      timestamp: new Date().toISOString(),
    });
  }, [error]);

  return (
    <ErrorState
      error={error}
      homeHref="/app/messages"
      homeLabel="Back to Messages"
      onRetry={reset}
      surface="your conversations"
    />
  );
}
