import { AdminList, AdminSection } from "@/components/admin-section";
import { getAdminList } from "@/lib/data/admin";

export default async function AdminProfilesPage() {
  const profiles = await getAdminList("profiles");
  return (
    <AdminSection description="Inspect profile completeness, verification status, and trust presentation." title="Profiles">
      <AdminList empty="No profiles" items={profiles} render={(item) => <p className="text-sm text-slate-700">{(item as { headline?: string }).headline ?? "Profile"}</p>} />
    </AdminSection>
  );
}
