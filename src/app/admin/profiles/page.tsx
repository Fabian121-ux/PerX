import { AdminList, AdminSection } from "@/components/admin-section";
import { CursorPagination } from "@/components/cursor-pagination";
import { requireCapabilityOrNotFound } from "@/lib/auth/session";
import { getAdminListPage } from "@/lib/data/admin";

export default async function AdminProfilesPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  await requireCapabilityOrNotFound("users:read");
  const params = await searchParams;
  const page = await getAdminListPage("profiles", {
    cursor: params.cursor,
    pageSize: 20,
  });

  return (
    <AdminSection
      description="Inspect profile completeness, verification status, and trust presentation."
      title="Profiles"
    >
      <AdminList
        empty="No profiles"
        items={page.items}
        render={(item) => (
          <p className="text-sm text-slate-700">
            {(item as { headline?: string }).headline ?? "Profile"}
          </p>
        )}
      />
      <CursorPagination
        basePath="/admin/profiles"
        cursor={page.cursor}
        label="Profiles pagination"
        nextCursor={page.nextCursor}
      />
    </AdminSection>
  );
}
