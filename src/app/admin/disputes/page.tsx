import Link from "next/link";

import { AdminList, AdminSection } from "@/components/admin-section";
import { Badge } from "@/components/ui/badge";
import { CursorPagination } from "@/components/cursor-pagination";
import { requireCapabilityOrNotFound } from "@/lib/auth/session";
import { getAdminListPage } from "@/lib/data/admin";

type DisputeRow = {
  deal: { id: string; status: string; proposal: { opportunity: { title: string } } };
  id: string;
  openedBy: { id: string; name: string; username: string };
  reason: string;
  resolution: string | null;
  status: string;
  updatedAt: Date;
};

export default async function AdminDisputesPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  await requireCapabilityOrNotFound("deals:review");
  const params = await searchParams;
  const page = await getAdminListPage("disputes", {
    cursor: params.cursor,
    pageSize: 20,
  });

  return (
    <AdminSection
      description="Track dispute status, the submitted reason, and the person who opened the dispute. Follow the account link for participant context."
      title="Disputes"
    >
      <AdminList
        empty="No disputes"
        items={page.items}
        render={(item) => {
          const dispute = item as DisputeRow;
          return (
            <article className="grid gap-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Badge>{dispute.status.toLocaleLowerCase().replaceAll("_", " ")}</Badge>
                <time
                  className="text-xs text-slate-500"
                  dateTime={dispute.updatedAt.toISOString()}
                >
                  Updated {dispute.updatedAt.toLocaleDateString()}
                </time>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  {dispute.reason}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Deal: {dispute.deal.proposal.opportunity.title} ·{" "}
                  {dispute.deal.status.toLocaleLowerCase().replaceAll("_", " ")}
                </p>
                <p className="mt-1 break-all text-xs text-slate-500">
                  Deal reference: {dispute.deal.id}
                </p>
              </div>
              {dispute.resolution ? (
                <p className="text-sm text-slate-600">
                  Resolution: {dispute.resolution}
                </p>
              ) : (
                <p className="text-xs text-amber-700">Resolution not recorded</p>
              )}
              <p className="text-sm text-slate-600">
                Opened by {dispute.openedBy.name} · @{dispute.openedBy.username}
              </p>
              <Link
                className="w-fit text-sm font-bold text-[color:var(--px-primary)] hover:underline"
                href={`/admin/users/${dispute.openedBy.id}`}
              >
                Open account record
              </Link>
            </article>
          );
        }}
      />
      <CursorPagination
        basePath="/admin/disputes"
        cursor={page.cursor}
        label="Disputes pagination"
        nextCursor={page.nextCursor}
      />
    </AdminSection>
  );
}
