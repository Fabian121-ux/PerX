import Link from "next/link";

import { AdminSection } from "@/components/admin-section";
import { TraderDecisionControls } from "@/components/admin/trader-decision-controls";
import { Card, EmptyState } from "@/components/ui/card";
import { requireCapabilityOrNotFound } from "@/lib/auth/session";
import { getPrisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

/** Bounded: the queue is worked oldest-first, not browsed in bulk. */
const PAGE_SIZE = 20;

export default async function AdminTraderApplicationsPage() {
  await requireCapabilityOrNotFound("users:manage");

  const applications = await getPrisma().traderApplication.findMany({
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

  return (
    <AdminSection
      description="Applications for trading access. Approving grants the capability that allows publishing; declining withdraws it without removing existing content."
      title="Trader applications"
    >
      {applications.length === 0 ? (
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
