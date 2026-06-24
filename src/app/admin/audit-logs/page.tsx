import { AdminList, AdminSection } from "@/components/admin-section";
import { getAdminList } from "@/lib/data/admin";

export default async function AdminAuditLogsPage() {
  const logs = await getAdminList("audit");
  return (
    <AdminSection description="Audit trails for protected operations, admin actions, and state transitions." title="Audit logs">
      <AdminList empty="No audit logs" items={logs} render={(item) => <p className="text-sm text-slate-700">{(item as { action?: string }).action ?? "Audit event"}</p>} />
    </AdminSection>
  );
}
