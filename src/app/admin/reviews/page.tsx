import { AdminList, AdminSection } from "@/components/admin-section";
import { CursorPagination } from "@/components/cursor-pagination";
import { requireCapabilityOrNotFound } from "@/lib/auth/session";
import { getAdminListPage } from "@/lib/data/admin";

export default async function AdminReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  await requireCapabilityOrNotFound("reports:review");
  const params = await searchParams;
  const page = await getAdminListPage("reviews", {
    cursor: params.cursor,
    pageSize: 20,
  });

  return (
    <AdminSection
      description="Review eligibility, visibility, abuse reports, and rating integrity."
      title="Reviews"
    >
      <AdminList
        empty="No reviews"
        items={page.items}
        render={(item) => (
          <p className="text-sm text-slate-700">
            {(item as { title?: string }).title ?? "Review"}
          </p>
        )}
      />
      <CursorPagination
        basePath="/admin/reviews"
        cursor={page.cursor}
        label="Reviews pagination"
        nextCursor={page.nextCursor}
      />
    </AdminSection>
  );
}
