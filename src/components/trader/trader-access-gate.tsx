import Link from "next/link";

import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormNotice } from "@/components/ui/form-notice";
import type { TraderApplicationView } from "@/lib/trader/access";

/**
 * Shown where a creation surface would be, when the viewer has no trading
 * access yet.
 *
 * Replaces a generic 404. The route exists and the user is signed in - the only
 * missing piece is a grant they can request - so the page says what it is, what
 * to do, and offers exactly one primary action.
 *
 * Kept to a single card: this is a two-decision moment (apply, or not), and a
 * dense explainer here would be the "wall of information" the product is trying
 * to avoid.
 */
export function TraderAccessGate({
  application,
}: {
  application: TraderApplicationView | null;
}) {
  const status = application?.status ?? null;

  if (status === "PENDING_REVIEW") {
    return (
      <GateShell title="Your trader application is under review">
        <FormNotice tone="info">
          Submitted
          {application?.submittedAt
            ? ` ${application.submittedAt.toLocaleDateString()}`
            : ""}
          . We&apos;ll notify you when a decision has been made.
        </FormNotice>
        <p className="text-sm leading-6 text-[color:var(--px-text-muted)]">
          You can keep using everything else on PerX while you wait.
        </p>
        <ButtonLink href="/app/trader">View application</ButtonLink>
      </GateShell>
    );
  }

  if (status === "NEEDS_CHANGES") {
    return (
      <GateShell title="Your application needs a few changes">
        <FormNotice tone="warning">
          {application?.reviewerNote ??
            "A reviewer asked for more detail before they can approve trading access."}
        </FormNotice>
        <ButtonLink href="/app/trader">Update application</ButtonLink>
      </GateShell>
    );
  }

  if (status === "REJECTED" || status === "SUSPENDED") {
    return (
      <GateShell title="Trading access is not available on this account">
        <FormNotice tone="warning">
          {application?.reviewerNote ??
            "Trading access was declined for this account."}
        </FormNotice>
        <p className="text-sm leading-6 text-[color:var(--px-text-muted)]">
          Everything else on PerX continues to work as normal.
        </p>
        <ButtonLink href="/app/support" variant="secondary">
          Contact support
        </ButtonLink>
      </GateShell>
    );
  }

  return (
    <GateShell title="Become a Trader to create">
      <p className="text-sm leading-6 text-[color:var(--px-text-muted)]">
        Traders publish listings, projects and other opportunities on PerX. It
        takes about a minute to apply.
      </p>
      <ButtonLink href="/app/trader">Become a Trader</ButtonLink>
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <Link
          className="font-medium text-[color:var(--px-text-muted)] hover:text-[color:var(--px-text)]"
          href="/app"
        >
          Maybe later
        </Link>
        {status === "DRAFT" ? (
          <Link
            className="font-medium text-[color:var(--px-primary)] hover:text-[color:var(--px-primary-strong)]"
            href="/app/trader"
          >
            Continue your application
          </Link>
        ) : null}
      </div>
    </GateShell>
  );
}

function GateShell({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <main className="mx-auto grid w-full max-w-md gap-4 px-4 py-10 sm:px-6">
      <Card className="grid gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-[color:var(--px-primary)]">
            Trader access
          </p>
          <h1 className="mt-2 text-2xl font-bold text-[color:var(--px-text)]">
            {title}
          </h1>
        </div>
        {children}
      </Card>
    </main>
  );
}
