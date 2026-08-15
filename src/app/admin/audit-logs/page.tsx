import { AdminList, AdminSection } from "@/components/admin-section";
import { CursorPagination } from "@/components/cursor-pagination";
import { getAdminListPage } from "@/lib/data/admin";
import { requireCapabilityOrNotFound } from "@/lib/auth/session";

export default async function AdminAuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  await requireCapabilityOrNotFound("audit:read");
  const params = await searchParams;
  const page = await getAdminListPage("audit", {
    cursor: params.cursor,
    pageSize: 30,
  });
  return (
    <AdminSection description="Audit trails for protected operations, admin actions, and state transitions." title="Audit logs">
      <AdminList empty="No audit logs" items={page.items} render={(item) => <p className="text-sm text-slate-700">{(item as { action?: string }).action ?? "Audit event"}</p>} />
      <CursorPagination
        basePath="/admin/audit"
        cursor={page.cursor}
        label="Audit logs pagination"
        nextCursor={page.nextCursor}
      />
    </AdminSection>
  );
}
