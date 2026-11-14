import Link from "next/link";

import { AdminList, AdminSection } from "@/components/admin-section";
import { Badge } from "@/components/ui/badge";
import { CursorPagination } from "@/components/cursor-pagination";
import { requireCapabilityOrNotFound } from "@/lib/auth/session";
import { getAdminListPage } from "@/lib/data/admin";

type OpportunityRow = {
  id: string;
  moderationStatus: string;
  owner: { id: string; name: string; username: string };
  status: string;
  title: string;
  type: string;
  updatedAt: Date;
};

function humanize(value: string) {
  return value.toLocaleLowerCase().replaceAll("_", " ");
}

export default async function AdminOpportunitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  await requireCapabilityOrNotFound("opportunity:moderate");
  const params = await searchParams;
  const page = await getAdminListPage("opportunities", {
    cursor: params.cursor,
    pageSize: 20,
  });

  return (
    <AdminSection
      description="Review listing state, moderation status, and ownership. Use the linked account record for owner context."
      title="Opportunities"
    >
      <AdminList
        empty="No opportunities"
        items={page.items}
        render={(item) => {
          const opportunity = item as OpportunityRow;
          return (
            <article className="grid gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge>{humanize(opportunity.type)}</Badge>
                <Badge>{humanize(opportunity.moderationStatus)}</Badge>
                <Badge>{humanize(opportunity.status)}</Badge>
              </div>
              <h2 className="font-bold text-slate-900">{opportunity.title}</h2>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-slate-600">
                  Owner: {opportunity.owner.name} · @{opportunity.owner.username}
                </p>
                <time
                  className="text-xs text-slate-500"
                  dateTime={opportunity.updatedAt.toISOString()}
                >
                  Updated {opportunity.updatedAt.toLocaleDateString()}
                </time>
              </div>
              <Link
                className="w-fit text-sm font-bold text-[color:var(--px-primary)] hover:underline"
                href={`/admin/users/${opportunity.owner.id}`}
              >
                Open owner account
              </Link>
            </article>
          );
        }}
      />
      <CursorPagination
        basePath="/admin/opportunities"
        cursor={page.cursor}
        label="Opportunities pagination"
        nextCursor={page.nextCursor}
      />
    </AdminSection>
  );
}
