import { AdminList, AdminSection } from "@/components/admin-section";
import { getAdminList } from "@/lib/data/admin";

export default async function AdminVerificationPage() {
  const requests = await getAdminList("verification");
  return (
    <AdminSection description="Review verification requests and account trust evidence." title="Verification requests">
      <AdminList empty="No verification requests" items={requests} render={(item) => <p className="text-sm text-slate-700">{(item as { status?: string }).status ?? "Verification request"}</p>} />
    </AdminSection>
  );
}
