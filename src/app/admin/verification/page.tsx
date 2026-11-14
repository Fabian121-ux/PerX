import { AdminList, AdminSection } from "@/components/admin-section";
import { CursorPagination } from "@/components/cursor-pagination";
import { requireCapabilityOrNotFound } from "@/lib/auth/session";
import { getAdminListPage } from "@/lib/data/admin";

export default async function AdminVerificationPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  await requireCapabilityOrNotFound("admin:moderate");
  const params = await searchParams;
  const page = await getAdminListPage("verification", {
    cursor: params.cursor,
    pageSize: 20,
  });

  return (
    <AdminSection
      description="Review verification requests and account trust evidence."
      title="Verification requests"
    >
      <AdminList
        empty="No verification requests"
        items={page.items}
        render={(item) => (
          <p className="text-sm text-slate-700">
            {(item as { status?: string }).status ?? "Verification request"}
          </p>
        )}
      />
      <CursorPagination
        basePath="/admin/verification"
        cursor={page.cursor}
        label="Verification requests pagination"
        nextCursor={page.nextCursor}
      />
    </AdminSection>
  );
}
