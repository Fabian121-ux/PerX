import { AdminList, AdminSection } from "@/components/admin-section";
import { getAdminList } from "@/lib/data/admin";

export default async function AdminReviewsPage() {
  const reviews = await getAdminList("reviews");
  return (
    <AdminSection description="Review eligibility, visibility, abuse reports, and rating integrity." title="Reviews">
      <AdminList empty="No reviews" items={reviews} render={(item) => <p className="text-sm text-slate-700">{(item as { title?: string }).title ?? "Review"}</p>} />
    </AdminSection>
  );
}
