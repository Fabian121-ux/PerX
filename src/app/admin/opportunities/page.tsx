import { AdminList, AdminSection } from "@/components/admin-section";
import { getAdminList } from "@/lib/data/admin";

export default async function AdminOpportunitiesPage() {
  const opportunities = await getAdminList("opportunities");
  return (
    <AdminSection description="Moderate opportunity status, ownership, publication state, and reports." title="Opportunities">
      <AdminList empty="No opportunities" items={opportunities} render={(item) => <p className="text-sm text-slate-700">{(item as { title?: string }).title ?? "Opportunity"}</p>} />
    </AdminSection>
  );
}
