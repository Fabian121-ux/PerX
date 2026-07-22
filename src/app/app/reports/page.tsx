import { AppSection } from "@/components/app-section";
import { getCurrentUser } from "@/lib/auth/session";
import { getPrisma } from "@/lib/db/prisma";
import { Card, EmptyState } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

export default async function ReportsPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const reports = await getPrisma().opportunityReport.findMany({
    where: { reporterId: user.id },
    orderBy: { createdAt: "desc" },
    include: { opportunity: true }
  });

  return (
    <AppSection
      title="Reports"
      description="Review account, deal, and marketplace reports you have submitted."
    >
      {reports.length > 0 ? (
        <div className="grid gap-4">
          {reports.map(report => (
            <Card key={report.id} className="flex flex-col gap-3">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-[color:var(--px-text)]">
                    Report against: <Link href={`/app/opportunities/${report.opportunity.slug}`} className="text-[color:var(--px-primary)] hover:underline">{report.opportunity.title}</Link>
                  </h3>
                  <p className="mt-1 text-sm font-semibold uppercase tracking-wide text-[color:var(--px-text-muted)]">{report.reason}</p>
                </div>
                <Badge className={
                  report.status === "OPEN" ? "bg-amber-100 text-amber-800" :
                  report.status === "REVIEWING" ? "bg-blue-100 text-blue-800" :
                  report.status === "ACTIONED" ? "bg-emerald-100 text-emerald-800" :
                  "bg-slate-100 text-slate-800"
                }>
                  {report.status}
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
