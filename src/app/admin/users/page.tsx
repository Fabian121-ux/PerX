import { AdminList, AdminSection } from "@/components/admin-section";
import { getAdminList } from "@/lib/data/admin";

export default async function AdminUsersPage() {
  const users = await getAdminList("users");
  return (
    <AdminSection description="Review account state, roles, activity, and moderation risk." title="Users">
      <AdminList empty="No users" items={users} render={(item) => <AdminRecord item={item} />} />
    </AdminSection>
  );
}

function AdminRecord({ item }: { item: unknown }) {
  const record = item as { email?: string; name?: string; username?: string };
  return <p className="text-sm text-slate-700">{record.name ?? record.email ?? record.username ?? "User record"}</p>;
}
