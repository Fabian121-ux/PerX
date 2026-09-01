"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";

/**
 * Retry control for an unavailable Trader application status.
 *
 * The status is rendered by a server component, so recovery means re-requesting
 * the route payload rather than resetting local state - the same reason
 * `SectionBoundary` refreshes instead of remounting.
 *
 * Deliberately one small control: a failed status lookup should not turn the
 * page into a diagnostic panel.
 */
export function TraderStatusRetry() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      className="inline-flex min-h-11 w-fit items-center gap-1.5 rounded-[var(--px-radius-sm)] border border-[color:var(--px-border)] bg-[color:var(--px-surface)] px-4 text-sm font-black text-[color:var(--px-text)] transition hover:bg-[color:var(--px-surface-soft)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)] disabled:opacity-60"
      data-testid="trader-status-retry"
      disabled={pending}
      onClick={() => startTransition(() => router.refresh())}
      type="button"
    >
      <RotateCcw aria-hidden size={14} />
      {pending ? "Checking" : "Try again"}
    </button>
  );
}
