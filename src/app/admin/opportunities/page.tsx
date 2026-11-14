import { AdminList, AdminSection } from "@/components/admin-section";
import { CursorPagination } from "@/components/cursor-pagination";
import { requireCapabilityOrNotFound } from "@/lib/auth/session";
import { getAdminListPage } from "@/lib/data/admin";

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
      description="Moderate opportunity status, ownership, publication state, and reports."
      title="Opportunities"
    >
      <AdminList
        empty="No opportunities"
        items={page.items}
        render={(item) => (
          <p className="text-sm text-slate-700">
            {(item as { title?: string }).title ?? "Opportunity"}
          </p>
        )}
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
