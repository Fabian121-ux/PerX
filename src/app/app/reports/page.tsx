import { AppSection } from "@/components/app-section";
import { getCurrentUser } from "@/lib/auth/session";
import { getPrisma } from "@/lib/db/prisma";
import { Card, EmptyState } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ alreadySubmitted?: string; submitted?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;
  const params = await searchParams;

  const [opportunityReports, userReports] = await Promise.all([
    getPrisma().opportunityReport.findMany({
      where: { reporterId: user.id },
      orderBy: { createdAt: "desc" },
      include: { opportunity: true }
    }),
    getPrisma().userReport.findMany({
      where: { reporterId: user.id },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const reports = [
    ...opportunityReports.map((report) => ({
      createdAt: report.createdAt,
      details: report.details,
      href: `/app/opportunities/${report.opportunity.slug}`,
      id: report.id,
      reason: report.reason,
      status: mapOpportunityReportStatus(report.status),
      targetLabel: report.opportunity.title,
      targetType: "Opportunity",
    })),
    ...userReports.map((report) => ({
      createdAt: report.createdAt,
      details: report.details,
      href: getReportHref(report),
      id: report.id,
      reason: report.category,
      status: report.status,
      targetLabel: formatTargetType(report.targetType),
      targetType: formatTargetType(report.targetType),
    })),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return (
    <AppSection
      title="Reports"
      description="Review account, deal, and marketplace reports you have submitted."
    >
      {params.submitted ? (
        <div className="mb-4 rounded-[var(--px-radius-sm)] bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">
          Report submitted for moderation review.
        </div>
      ) : null}
      {params.alreadySubmitted ? (
        <div className="mb-4 rounded-[var(--px-radius-sm)] bg-amber-50 p-3 text-sm font-semibold text-amber-800">
          You already have an open report for that item.
        </div>
      ) : null}
      {reports.length > 0 ? (
        <div className="grid gap-4">
          {reports.map(report => (
            <Card key={report.id} className="flex flex-col gap-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="font-semibold text-[color:var(--px-text)]">
                    Report against:{" "}
                    {report.href ? (
                      <Link href={report.href} className="text-[color:var(--px-primary)] hover:underline">{report.targetLabel}</Link>
                    ) : (
                      <span>{report.targetLabel}</span>
                    )}
                  </h3>
                  <p className="mt-1 text-sm font-semibold uppercase tracking-wide text-[color:var(--px-text-muted)]">{formatReason(report.reason)}</p>
                </div>
                <Badge className={
                  report.status === "SUBMITTED" ? "bg-amber-100 text-amber-800" :
                  report.status === "IN_REVIEW" ? "bg-blue-100 text-blue-800" :
                  report.status === "ACTION_TAKEN" || report.status === "RESOLVED" ? "bg-emerald-100 text-emerald-800" :
                  "bg-slate-100 text-slate-800"
                }>
                  {report.status.toLowerCase().replaceAll("_", " ")}
                </Badge>
              </div>
              {report.details && (
                <p className="text-sm text-[color:var(--px-text-muted)] line-clamp-3">
                  {report.details}
                </p>
              )}
              <p className="mt-2 text-xs text-[color:var(--px-text-muted)]">
                Submitted on {new Date(report.createdAt).toLocaleDateString()}
              </p>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No reports submitted"
          body="You haven't submitted any reports. If you see suspicious activity, report it from the opportunity page."
        />
      )}
    </AppSection>
  );
}

function mapOpportunityReportStatus(status: string) {
  if (status === "OPEN") return "SUBMITTED";
  if (status === "REVIEWING") return "IN_REVIEW";
  if (status === "ACTIONED") return "ACTION_TAKEN";
  return "DISMISSED";
}

function formatReason(reason: string) {
  return reason.toLowerCase().replaceAll("_", " ");
}

function formatTargetType(targetType: string) {
  return targetType.toLowerCase().replaceAll("_", " ");
}

function getReportHref(report: {
  contextConversationId: string | null;
  contextMessageId: string | null;
  targetId: string;
  targetType: string;
}) {
  if (report.targetType === "MESSAGE" && report.contextConversationId) {
    const messageQuery = report.contextMessageId
      ? `?message=${encodeURIComponent(report.contextMessageId)}`
      : "";
    return `/app/messages/${report.contextConversationId}${messageQuery}`;
  }
  if (report.targetType === "CONVERSATION") {
    return `/app/messages/${report.targetId}`;
  }
  if (report.targetType === "DEAL") {
    return `/app/deals/${report.targetId}`;
  }
  return null;
}
