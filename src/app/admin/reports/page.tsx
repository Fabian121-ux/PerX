import { Badge } from "@/components/ui/badge";
import { Card, EmptyState } from "@/components/ui/card";
import { AdminSection } from "@/components/admin-section";
import { CursorPagination } from "@/components/cursor-pagination";
import { ButtonLink } from "@/components/ui/button";
import { requireCapabilityOrNotFound } from "@/lib/auth/session";
import { createModerationCaseForReportAction } from "@/features/admin/actions";
import {
  formatAdminValue,
  getAdminReportsOverviewPage,
  getRecentBlockRows,
  safeUserLabel,
} from "@/lib/admin/moderation-records";

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  await requireCapabilityOrNotFound("reports:review");
  const params = await searchParams;
  const [page, blockRows] = await Promise.all([
    getAdminReportsOverviewPage({
      cursor: params.cursor,
      pageSize: 20,
    }),
    getRecentBlockRows(),
  ]);
  const reports = page.items;

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
                  <Badge>{formatAdminValue(report.targetType)}</Badge>
                  <Badge className={statusClass(report.status)}>
                    {formatAdminValue(report.status)}
                  </Badge>
                  {report.caseStatus ? (
                    <Badge>{formatAdminValue(report.caseStatus)}</Badge>
                  ) : null}
                </div>
                <h2 className="mt-3 truncate text-sm font-black">
                  {formatAdminValue(report.category)}
                </h2>
                <p className="mt-1 truncate text-sm text-slate-600">
                  Target: {report.target}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Reporter: {safeUserLabel(report.reporter, report.reporterId)}
                </p>
              </div>
              <div className="grid gap-2 sm:justify-items-end">
                <p className="text-xs font-semibold text-slate-500 sm:text-right">
                  {report.createdAt.toLocaleString()}
                </p>
                {report.caseId ? (
                  <ButtonLink
                    href={`/admin/moderation/cases/${report.caseId}`}
                    size="sm"
                    variant="secondary"
                  >
                    Open case
                  </ButtonLink>
                ) : report.canCreateCase ? (
                  <form action={createModerationCaseForReportAction}>
                    <input name="reportId" type="hidden" value={report.id} />
                    <button
                      className="rounded-[var(--px-radius-sm)] border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                      type="submit"
                    >
                      Create case
                    </button>
                  </form>
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
      <CursorPagination
        basePath="/admin/reports"
        cursor={page.cursor}
        label="Admin reports pagination"
        nextCursor={page.nextCursor}
      />
      <section className="mt-6">
        <h2 className="text-base font-black text-white">
          Recent block metadata
        </h2>
        <p className="mt-1 text-sm text-slate-300">
          Blocks are user safety controls, not automatic moderation violations.
          Linked reports create cases separately.
        </p>
        {blockRows.length ? (
          <div className="mt-3 grid gap-3">
            {blockRows.map((block) => (
              <Card
                className="grid gap-3 bg-white/95 text-slate-900 sm:grid-cols-[minmax(0,1fr)_auto]"
                key={block.id}
              >
                <div>
                  <div className="flex flex-wrap gap-2">
                    <Badge>User block only</Badge>
                    {block.reason ? <Badge>Reason supplied</Badge> : null}
                  </div>
                  <p className="mt-2 text-sm text-slate-600">
                    Blocker: {safeUserLabel(block.blocker, block.blockerUserId)}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    Blocked:{" "}
                    {safeUserLabel(block.blockedUser, block.blockedUserId)}
                  </p>
                </div>
                <p className="text-xs font-semibold text-slate-500 sm:text-right">
                  {block.createdAt.toLocaleString()}
                </p>
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState
            body="No block records are available."
            title="No blocks"
          />
        )}
      </section>
    </AdminSection>
  );
}

function statusClass(status: string) {
  if (status === "SUBMITTED") return "bg-amber-100 text-amber-800";
  if (status === "IN_REVIEW") return "bg-blue-100 text-blue-800";
  if (status === "ACTION_TAKEN" || status === "RESOLVED") {
    return "bg-emerald-100 text-emerald-800";
  }
  return "bg-slate-100 text-slate-700";
}
