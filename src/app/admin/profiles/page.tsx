import Link from "next/link";

import { AdminList, AdminSection } from "@/components/admin-section";
import { Badge } from "@/components/ui/badge";
import { CursorPagination } from "@/components/cursor-pagination";
import { requireCapabilityOrNotFound } from "@/lib/auth/session";
import { getAdminListPage } from "@/lib/data/admin";

type ProfileRow = {
  headline: string;
  profileCompleteness: number;
  trustScore: number;
  updatedAt: Date;
  user: { id: string; name: string; username: string };
};

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
      description="Inspect profile completeness, verification status, and trust presentation. Open a linked account to review its full administrative record."
      title="Profiles"
    >
      <AdminList
        empty="No profiles"
        items={page.items}
        render={(item) => {
          const profile = item as ProfileRow;
          return (
            <article className="grid gap-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="font-bold text-slate-900">
                    {profile.headline || "Profile"}
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    {profile.user.name} · @{profile.user.username}
                  </p>
                </div>
                <Badge>{profile.profileCompleteness}% complete</Badge>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
                <span>Trust score: {profile.trustScore}</span>
                <time dateTime={profile.updatedAt.toISOString()}>
                  Updated {profile.updatedAt.toLocaleDateString()}
                </time>
              </div>
              <Link
                className="w-fit text-sm font-bold text-[color:var(--px-primary)] hover:underline"
                href={`/admin/users/${profile.user.id}`}
              >
                Open account record
              </Link>
            </article>
          );
        }}
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
