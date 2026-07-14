"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertCircle } from "lucide-react";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("App Error Boundary caught:", error);
  }, [error]);

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center bg-[color:var(--px-page)] px-4 py-16 text-center">
      <div className="rounded-full bg-red-100 p-4 text-red-600">
        <AlertCircle size={32} />
      </div>
      <h1 className="mt-6 text-2xl font-black text-[color:var(--px-text)]">
        Workspace Unavailable
      </h1>
      <p className="mt-4 max-w-md text-sm leading-6 text-[color:var(--px-text-muted)]">
        We could not load your secure workspace data. This is typically due to a temporary connection issue.
      </p>
      <div className="mt-8 flex gap-4">
        <button
          onClick={() => reset()}
          className="rounded-[var(--px-radius-sm)] bg-[color:var(--px-primary)] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[color:var(--px-primary-strong)]"
        >
          Try again
        </button>
        <Link
          href="/"
          className="rounded-[var(--px-radius-sm)] border border-[color:var(--px-border)] bg-[color:var(--px-surface)] px-5 py-2.5 text-sm font-bold text-[color:var(--px-text)] transition hover:bg-[color:var(--px-surface-soft)]"
        >
          Return Home
        </Link>
      </div>
    </div>
  );
}
