import { AdminList, AdminSection } from "@/components/admin-section";
import { getAdminList } from "@/lib/data/admin";
import { requireCapabilityOrNotFound } from "@/lib/auth/session";

export default async function AdminDisputesPage() {
  await requireCapabilityOrNotFound("deals:review");
  const disputes = await getAdminList("disputes");
  return (
    <AdminSection description="Track deal disputes, evidence, status, and resolution." title="Disputes">
      <AdminList empty="No disputes" items={disputes} render={(item) => <p className="text-sm text-slate-700">{(item as { reason?: string }).reason ?? "Dispute"}</p>} />
    </AdminSection>
  );
}
