"use client";

import { AlertCircle } from "lucide-react";
import Link from "next/link";

export default function MessagesError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="grid min-h-[70dvh] place-items-center px-4 py-10 text-center">
      <div className="w-full max-w-md rounded-[28px] border border-[color:var(--px-border)] bg-[color:var(--px-surface)] p-7 shadow-[var(--px-shadow)]">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-300">
          <AlertCircle aria-hidden size={26} />
        </div>
        <h1 className="mt-5 text-2xl font-black text-[color:var(--px-text)]">
          Messages are temporarily unavailable
        </h1>
        <p className="mt-3 text-sm leading-6 text-[color:var(--px-text-muted)]">
          Your conversations are still secure. Try loading them again, or return
          to another area of PerX.
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <button
            className="min-h-11 rounded-xl bg-[color:var(--px-primary)] px-4 py-2.5 text-sm font-black text-white hover:bg-[color:var(--px-primary-strong)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)]"
            onClick={reset}
            type="button"
          >
            Try again
          </button>
          <Link
            className="grid min-h-11 place-items-center rounded-xl border border-[color:var(--px-border)] px-4 py-2.5 text-sm font-black text-[color:var(--px-text)] hover:bg-[color:var(--px-surface-soft)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)]"
            href="/app/messages"
          >
            Back to Messages
          </Link>
          <Link
            className="grid min-h-11 place-items-center rounded-xl border border-[color:var(--px-border)] px-4 py-2.5 text-sm font-black text-[color:var(--px-text)] hover:bg-[color:var(--px-surface-soft)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)]"
            href="/app"
          >
            Go to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
