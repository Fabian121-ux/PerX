"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useTransition } from "react";

const REFRESH_MS = 60_000;

/** Refreshes the server-authorized tracking view while someone is using it.
 * It never manufactures courier events. No polling runs in background tabs.
 */
export function TrackingAutoRefresh() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const refresh = useCallback(() => {
    if (document.visibilityState !== "visible") return;
    startTransition(() => router.refresh());
  }, [router]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
      if (!connection?.saveData) refresh();
    }, REFRESH_MS);
    return () => window.clearInterval(interval);
  }, [refresh]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-[color:var(--px-text-muted)]">Updates every minute while open</span>
      <button
        className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[color:var(--px-border-strong)] bg-[color:var(--px-surface)] px-3 text-xs font-bold text-[color:var(--px-text)] hover:bg-[color:var(--px-surface-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)] disabled:opacity-60"
        disabled={pending}
        onClick={refresh}
        type="button"
      >
        <RefreshCw aria-hidden className={pending ? "animate-spin motion-reduce:animate-none" : ""} size={16} />
        {pending ? "Checking..." : "Check now"}
      </button>
    </div>
  );
}
