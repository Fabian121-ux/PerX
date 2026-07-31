"use client";

import { AlertCircle } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

export default function SearchError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Search route error:", error);
  }, [error]);

  return (
    <div className="grid min-h-[50vh] place-items-center px-4 py-12 text-center">
      <div className="max-w-lg">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-red-100 text-red-700">
          <AlertCircle aria-hidden size={26} />
        </span>
        <h1 className="mt-5 text-2xl font-black text-[color:var(--px-text)]">
          Search is temporarily unavailable
        </h1>
        <p className="mt-3 text-sm leading-6 text-[color:var(--px-text-muted)]">
          PerX could not load the real directory or listing data. No mock
          results were substituted.
        </p>
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <button
            className="min-h-11 rounded-[var(--px-radius-sm)] bg-[color:var(--px-primary)] px-4 py-2 text-sm font-bold text-white"
            onClick={() => reset()}
            type="button"
          >
            Try again
          </button>
          <Link
            className="inline-flex min-h-11 items-center justify-center rounded-[var(--px-radius-sm)] border border-[color:var(--px-border)] bg-[color:var(--px-surface)] px-4 py-2 text-sm font-bold text-[color:var(--px-text)]"
            href="/app"
          >
            Return home
          </Link>
        </div>
      </div>
    </div>
  );
}
