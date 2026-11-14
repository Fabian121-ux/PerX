import Link from "next/link";

import { AdminList, AdminSection } from "@/components/admin-section";
import { Badge } from "@/components/ui/badge";
import { CursorPagination } from "@/components/cursor-pagination";
import { requireCapabilityOrNotFound } from "@/lib/auth/session";
import { getAdminListPage } from "@/lib/data/admin";

type VerificationRow = {
  id: string;
  notes: string | null;
  profile: {
    headline: string;
    user: { id: string; name: string; username: string };
  };
  status: string;
  updatedAt: Date;
};

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
      description="Review verification requests and their linked account context. Open an account record before making a trust decision."
      title="Verification requests"
    >
      <AdminList
        empty="No verification requests"
        items={page.items}
        render={(item) => {
          const request = item as VerificationRow;
          return (
            <article className="grid gap-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Badge>{request.status.toLocaleLowerCase().replaceAll("_", " ")}</Badge>
                <time
                  className="text-xs text-slate-500"
                  dateTime={request.updatedAt.toISOString()}
                >
                  Updated {request.updatedAt.toLocaleDateString()}
                </time>
              </div>
              <div>
                <h2 className="font-bold text-slate-900">
                  {request.profile.headline || "Verification request"}
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  {request.profile.user.name} · @{request.profile.user.username}
                </p>
              </div>
              {request.notes ? (
                <p className="text-sm text-slate-600">{request.notes}</p>
              ) : null}
              <Link
                className="w-fit text-sm font-bold text-[color:var(--px-primary)] hover:underline"
                href={`/admin/users/${request.profile.user.id}`}
              >
                Open account record
              </Link>
            </article>
          );
        }}
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
