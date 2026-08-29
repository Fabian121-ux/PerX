"use client";

import Link from "next/link";
import { AlertCircle } from "lucide-react";

import { presentError } from "@/lib/errors/taxonomy";

/**
 * Shared, compact failure surface for route error boundaries.
 *
 * Deliberately small: a title, one honest sentence, one primary action, and a
 * reference id only when one exists. Reliability UX should not become a
 * diagnostic page.
 *
 * `onRetry` is wired to the boundary's own `reset()` so the button actually
 * re-renders the segment rather than only looking actionable.
 */
export function ErrorState({
  error,
  homeHref = "/app",
  homeLabel = "Back to Home",
  onRetry,
  surface,
}: {
  error: unknown;
  homeHref?: string;
  homeLabel?: string;
  onRetry?: () => void;
  surface?: string;
}) {
  const { canRetry, description, kind, title } = presentError(error, surface);
  const digest =
    typeof error === "object" && error !== null && "digest" in error
      ? String((error as { digest?: unknown }).digest ?? "")
      : "";
  const showRetry = canRetry && typeof onRetry === "function";

  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center px-4 py-12 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-full bg-[color:var(--px-warning-soft,rgba(245,158,11,0.15))] text-[color:var(--px-warning,#b45309)]">
        <AlertCircle aria-hidden size={24} />
      </span>
      <h1 className="mt-4 text-xl font-black text-[color:var(--px-text)]">
        {title}
      </h1>
      <p className="mt-2 text-sm leading-6 text-[color:var(--px-text-muted)]">
        {description}
      </p>
      <div className="mt-6 flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
        {showRetry ? (
          <button
            className="min-h-11 rounded-[var(--px-radius-sm)] bg-[color:var(--px-primary)] px-5 text-sm font-black text-white transition hover:bg-[color:var(--px-primary-strong)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)]"
            onClick={onRetry}
            type="button"
          >
            Try again
          </button>
        ) : null}
        <Link
          className="inline-flex min-h-11 items-center justify-center rounded-[var(--px-radius-sm)] border border-[color:var(--px-border)] bg-[color:var(--px-surface)] px-5 text-sm font-black text-[color:var(--px-text)] transition hover:bg-[color:var(--px-surface-soft)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)]"
          href={kind === "AUTH_REQUIRED" ? "/sign-in" : homeHref}
        >
          {kind === "AUTH_REQUIRED" ? "Sign in" : homeLabel}
        </Link>
      </div>
      {digest ? (
        <p className="mt-4 text-[11px] font-semibold text-[color:var(--px-text-muted)]">
          Reference: <span data-error-digest={digest}>{digest}</span>
        </p>
      ) : null}
    </div>
  );
}
