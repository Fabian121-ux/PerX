import Link from "next/link";
import { unstable_rethrow } from "next/navigation";

import { AdminSection } from "@/components/admin-section";
import { TraderDecisionControls } from "@/components/admin/trader-decision-controls";
import { Card, EmptyState } from "@/components/ui/card";
import { requireCapabilityOrNotFound } from "@/lib/auth/session";
import { getPrisma } from "@/lib/db/prisma";
import { classifyError } from "@/lib/errors/taxonomy";

export const dynamic = "force-dynamic";

/** Bounded: the queue is worked oldest-first, not browsed in bulk. */
const PAGE_SIZE = 20;

type ApplicationRow = {
  applicantKind: string;
  experience: string;
  headline: string;
  id: string;
  status: string;
  submittedAt: Date | null;
  tradeCategory: string;
  user: { id: string; name: string; username: string };
};

export default async function AdminTraderApplicationsPage() {
  // Authorization runs first and is deliberately outside the guarded region:
  // an unauthorized visitor must get notFound(), never a degraded state that
  // would confirm this route exists.
  await requireCapabilityOrNotFound("users:manage");

  /**
   * CRITICAL: this query previously ran bare.
   *
   * A merged-but-unapplied migration left `TraderApplication` absent in
   * production, and because nothing caught it the throw escaped the page,
   * reached the only boundary in the /admin subtree, and took the entire
   * portal down - navigation included - for 15 days.
   *
   * Containing the failure here keeps the blast radius at one queue: the admin
   * shell, its nav and every sibling page stay usable. "Failed to load" and
   * "nothing to review" are kept distinct, because telling a reviewer the queue
   * is empty when it could not be read invites them to close an open queue.
   */
  let applications: ApplicationRow[] = [];
  let applicationsUnavailable = false;
  try {
    applications = await getPrisma().traderApplication.findMany({
      orderBy: [{ submittedAt: "asc" }, { id: "asc" }],
      select: {
        applicantKind: true,
        experience: true,
        headline: true,
        id: true,
        status: true,
        submittedAt: true,
        tradeCategory: true,
        user: { select: { id: true, name: true, username: true } },
        // `reviewerNote` is omitted: the queue shows what is needed to decide.
      },
      take: PAGE_SIZE,
      where: { status: { in: ["PENDING_REVIEW", "NEEDS_CHANGES"] } },
    });
  } catch (error) {
    // `notFound()` and `redirect()` are implemented as thrown errors. Catching
    // them would silently convert a 404 or an auth redirect into a rendered
    // page, so they are re-thrown before anything else. `unstable_rethrow` is
    // the framework's own predicate, which also covers the dynamic-rendering
    // and postpone signals that a hand-rolled digest check would miss.
    unstable_rethrow(error);

    applicationsUnavailable = true;
    // Redacted by construction: a classification and a route, never the
    // message, stack or Prisma metadata. The outage digest was opaque in the
    // browser precisely because the raw object was logged where it could not
    // help; the kind is what an operator can actually act on.
    console.error("[perx:admin-trader-applications]", {
      digest:
        typeof error === "object" && error !== null && "digest" in error
          ? String((error as { digest?: unknown }).digest ?? "")
          : undefined,
      kind: classifyError(error),
      route: "/admin/trader-applications",
      timestamp: new Date().toISOString(),
    });
  }

  return (
    <AdminSection
      description="Applications for trading access. Approving grants the capability that allows publishing; declining withdraws it without removing existing content."
      title="Trader applications"
    >
      {applicationsUnavailable ? (
        // States what happened and nothing more. The cause is not established
        // here, so no cause is asserted - "check your connection" would be a
        // guess, and was wrong for the schema fault that caused the outage.
        <Card className="grid gap-2">
          <h2 className="font-bold text-white">
            Applications could not be loaded
          </h2>
          <p className="text-sm leading-6 text-slate-300">
            The review queue is unavailable right now. No application has
            changed, and no decision has been recorded. Other admin tools are
            unaffected.
          </p>
        </Card>
      ) : applications.length === 0 ? (
        <EmptyState
          body="Applications awaiting a decision will appear here."
          title="No applications to review"
        />
      ) : (
        applications.map((application) => (
          <Card key={application.id}>
            <article className="grid gap-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="font-bold text-white">
                    <Link
                      className="hover:underline"
                      href={`/admin/users/${application.user.id}`}
                    >
                      {application.user.name}
                    </Link>
                  </h2>
                  <p className="mt-1 text-sm text-slate-300">
                    @{application.user.username} ·{" "}
                    {application.applicantKind.toLowerCase()} ·{" "}
                    {application.tradeCategory}
                  </p>
                </div>
                <span className="rounded-full bg-amber-500/15 px-3 py-1 text-xs font-bold text-amber-200">
                  {application.status.replace(/_/g, " ").toLowerCase()}
                </span>
              </div>

              <p className="text-sm text-slate-200">{application.headline}</p>

              {/*
                Progressive disclosure: the reviewer reads the summary first and
                opens the longer answer only when it matters.
              */}
              <details className="text-sm text-slate-300">
                <summary className="cursor-pointer font-semibold text-slate-200">
                  Stated experience
                </summary>
                <p className="mt-2 whitespace-pre-wrap leading-6">
                  {application.experience}
                </p>
              </details>

              {application.submittedAt ? (
                <p className="text-xs text-slate-400">
                  Submitted {application.submittedAt.toISOString().slice(0, 10)}
                </p>
              ) : null}

              <TraderDecisionControls applicationId={application.id} />
            </article>
          </Card>
        ))
      )}
    </AdminSection>
  );
}
