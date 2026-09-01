"use client";

import { Component, type ReactNode, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";

/**
 * Compact failure boundary for a single optional feature section.
 *
 * Placed at feature ownership seams (profile activity, message profile
 * preview), not around arbitrary markup. The point is that one optional
 * section failing must not take down the route that contains it.
 *
 * ## Why Retry refreshes the route
 *
 * These sections are server components. When one throws, the failure arrives
 * as part of the RSC payload that has already been streamed to the browser, so
 * simply remounting the subtree re-renders the same failed result and appears
 * to do nothing. Real recovery requires re-requesting the payload, which is
 * what `router.refresh()` does. This was found by testing the control rather
 * than assuming it worked.
 *
 * The UI stays deliberately small - a short line and one action - so a failed
 * side rail never outweighs the working content around it.
 */

type Props = {
  children: ReactNode;
  /** Short, human name for what is unavailable, e.g. "Activity". */
  label: string;
  /** Stable hook for tests and diagnostics. */
  testId?: string;
};

function SectionFailure({
  label,
  onRecover,
  testId,
}: {
  label: string;
  onRecover: () => void;
  testId?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div
      className="rounded-[var(--px-radius-sm)] border border-[color:var(--px-border)] bg-[color:var(--px-surface)] px-4 py-3"
      data-testid={testId ?? "section-boundary-error"}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-[color:var(--px-text-muted)]">
          {label} unavailable
        </p>
        <button
          className="inline-flex min-h-11 items-center gap-1.5 rounded-[var(--px-radius-sm)] px-3 text-sm font-black text-[color:var(--px-primary)] hover:bg-[color:var(--px-surface-soft)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)] disabled:opacity-60"
          disabled={pending}
          onClick={() =>
            startTransition(() => {
              router.refresh();
              onRecover();
            })
          }
          type="button"
        >
          <RotateCcw aria-hidden size={14} />
          {pending ? "Retrying" : "Retry"}
        </button>
      </div>
    </div>
  );
}

export class SectionBoundary extends Component<
  Props,
  { failed: boolean; sourceKey: number }
> {
  state = { failed: false, sourceKey: 0 };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  /**
   * Clears the failed state so refreshed server content can render.
   *
   * `router.refresh()` alone is not enough: the boundary latches `failed` and
   * would keep showing the failure even after a healthy payload arrives. The
   * refresh re-fetches, and this resets the latch so the new children mount.
   */
  private recover = () => {
    this.setState((state) => ({
      failed: false,
      sourceKey: state.sourceKey + 1,
    }));
  };

  componentDidCatch(error: unknown) {
    // Structured and safe: the section name only. The underlying error stays
    // in server logs rather than reaching the browser.
    console.error("[perx:section-boundary]", {
      label: this.props.label,
      timestamp: new Date().toISOString(),
    });
    void error;
  }

  render() {
    if (!this.state.failed) {
      return <div key={this.state.sourceKey}>{this.props.children}</div>;
    }
    return (
      <SectionFailure
        label={this.props.label}
        onRecover={this.recover}
        testId={this.props.testId}
      />
    );
  }
}
