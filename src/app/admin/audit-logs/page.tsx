import { AdminList, AdminSection } from "@/components/admin-section";
import { getAdminList } from "@/lib/data/admin";
import { requireCapabilityOrNotFound } from "@/lib/auth/session";

export default async function AdminAuditLogsPage() {
  await requireCapabilityOrNotFound("audit:read");
  const logs = await getAdminList("audit");
  return (
    <AdminSection description="Audit trails for protected operations, admin actions, and state transitions." title="Audit logs">
      <AdminList empty="No audit logs" items={logs} render={(item) => <p className="text-sm text-slate-700">{(item as { action?: string }).action ?? "Audit event"}</p>} />
    </AdminSection>
  );
}
