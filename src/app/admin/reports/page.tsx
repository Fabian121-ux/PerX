import { Badge } from "@/components/ui/badge";
import { Card, EmptyState } from "@/components/ui/card";
import { AdminSection } from "@/components/admin-section";
import { getPrisma } from "@/lib/db/prisma";
import { ButtonLink } from "@/components/ui/button";

export default async function AdminReportsPage() {
  const [opportunityReports, userReports] = await Promise.all([
    getPrisma().opportunityReport.findMany({
      include: {
        opportunity: { select: { id: true, slug: true, title: true } },
        reporter: { select: { id: true, name: true, username: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    getPrisma().userReport.findMany({
      include: {
        moderationCases: {
          orderBy: { createdAt: "desc" },
          select: { id: true, status: true },
          take: 1,
        },
        reporter: { select: { id: true, name: true, username: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  const reports = [
    ...opportunityReports.map((report) => ({
      category: report.reason,
      createdAt: report.createdAt,
      id: report.id,
      reporter: report.reporter,
      status: mapOpportunityReportStatus(report.status),
      target: report.opportunity.title,
      targetType: "OPPORTUNITY",
    })),
    ...userReports.map((report) => ({
      category: report.category,
      createdAt: report.createdAt,
      id: report.id,
      reporter: report.reporter,
      status: report.status,
      target: report.targetId,
      targetType: report.targetType,
      caseId: report.moderationCases[0]?.id ?? null,
      caseStatus: report.moderationCases[0]?.status ?? null,
    })),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return (
    <AdminSection
      description="Review report metadata, then open scoped moderation cases for private content only when a reason is recorded."
      title="Reports"
    >
      {reports.length ? (
        <div className="grid gap-3">
          {reports.map((report) => (
            <Card
              className="grid gap-3 bg-white/95 text-slate-900 sm:grid-cols-[minmax(0,1fr)_auto]"
              key={`${report.targetType}-${report.id}`}
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>{formatValue(report.targetType)}</Badge>
                  <Badge className={statusClass(report.status)}>
                    {formatValue(report.status)}
                  </Badge>
                </div>
                <h2 className="mt-3 truncate text-sm font-black">
                  {formatValue(report.category)}
                </h2>
                <p className="mt-1 truncate text-sm text-slate-600">
                  Target: {report.target}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Reporter: {report.reporter.name} (@{report.reporter.username})
                </p>
              </div>
              <div className="grid gap-2 sm:justify-items-end">
                <p className="text-xs font-semibold text-slate-500 sm:text-right">
                  {report.createdAt.toLocaleString()}
                </p>
                {"caseId" in report && report.caseId ? (
                  <ButtonLink
                    href={`/admin/moderation/cases/${report.caseId}`}
                    size="sm"
                    variant="secondary"
                  >
                    Open case
                  </ButtonLink>
                ) : null}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          body="User-submitted reports and opportunity reports will appear here."
          title="No reports"
        />
      )}
    </AdminSection>
  );
}

function mapOpportunityReportStatus(status: string) {
  if (status === "OPEN") return "SUBMITTED";
  if (status === "REVIEWING") return "IN_REVIEW";
  if (status === "ACTIONED") return "ACTION_TAKEN";
  return "DISMISSED";
}

function formatValue(value: string) {
  return value.toLowerCase().replaceAll("_", " ");
}

function statusClass(status: string) {
  if (status === "SUBMITTED") return "bg-amber-100 text-amber-800";
  if (status === "IN_REVIEW") return "bg-blue-100 text-blue-800";
  if (status === "ACTION_TAKEN" || status === "RESOLVED") {
    return "bg-emerald-100 text-emerald-800";
  }
  return "bg-slate-100 text-slate-700";
}
