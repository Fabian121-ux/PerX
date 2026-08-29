"use client";

import { useEffect } from "react";

import { ErrorState } from "@/components/system/error-state";
import { classifyError } from "@/lib/errors/taxonomy";

export default function NotificationsError({
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
      route: "/app/notifications",
      timestamp: new Date().toISOString(),
    });
  }, [error]);

  // Previously told every user to "check your connection", including when the
  // server had failed. The taxonomy only says that for real transport errors.
  return (
    <ErrorState error={error} onRetry={reset} surface="your activity" />
  );
}
