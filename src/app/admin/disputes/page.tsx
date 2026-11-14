import { AdminList, AdminSection } from "@/components/admin-section";
import { CursorPagination } from "@/components/cursor-pagination";
import { requireCapabilityOrNotFound } from "@/lib/auth/session";
import { getAdminListPage } from "@/lib/data/admin";

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
      description="Track deal disputes, evidence, status, and resolution."
      title="Disputes"
    >
      <AdminList
        empty="No disputes"
        items={page.items}
        render={(item) => (
          <p className="text-sm text-slate-700">
            {(item as { reason?: string }).reason ?? "Dispute"}
          </p>
        )}
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
