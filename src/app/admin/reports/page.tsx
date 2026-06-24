import { AdminList, AdminSection } from "@/components/admin-section";
import { getAdminList } from "@/lib/data/admin";

export default async function AdminReportsPage() {
  const reports = await getAdminList("reports");
  return (
    <AdminSection description="Review reported opportunities and apply moderation actions." title="Reports">
      <AdminList empty="No reports" items={reports} render={(item) => <p className="text-sm text-slate-700">{(item as { reason?: string }).reason ?? "Report"}</p>} />
    </AdminSection>
  );
}
