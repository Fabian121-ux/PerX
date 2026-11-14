import Link from "next/link";

import { AdminList, AdminSection } from "@/components/admin-section";
import { Badge } from "@/components/ui/badge";
import { CursorPagination } from "@/components/cursor-pagination";
import { requireCapabilityOrNotFound } from "@/lib/auth/session";
import { getAdminListPage } from "@/lib/data/admin";

type ReviewRow = {
  author: { id: string; name: string; username: string };
  body: string;
  createdAt: Date;
  dealId: string;
  id: string;
  rating: number;
  subject: { id: string; name: string; username: string };
  title: string;
  visibility: string;
};

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
      description="Inspect review content, rating, visibility, and the users connected to each review. Follow either account link for its administrative record."
      title="Reviews"
    >
      <AdminList
        empty="No reviews"
        items={page.items}
        render={(item) => {
          const review = item as ReviewRow;
          return (
            <article className="grid gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge>{review.visibility.toLocaleLowerCase()}</Badge>
                <Badge>{review.rating} / 5</Badge>
              </div>
              <div>
                <h2 className="font-bold text-slate-900">{review.title}</h2>
                <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">
                  {review.body}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                <Link
                  className="font-semibold text-[color:var(--px-primary)] hover:underline"
                  href={`/admin/users/${review.author.id}`}
                >
                  Author: @{review.author.username}
                </Link>
                <Link
                  className="font-semibold text-[color:var(--px-primary)] hover:underline"
                  href={`/admin/users/${review.subject.id}`}
                >
                  Subject: @{review.subject.username}
                </Link>
              </div>
              <time
                className="text-xs text-slate-500"
                dateTime={review.createdAt.toISOString()}
              >
                Created {review.createdAt.toLocaleDateString()}
              </time>
              <p className="break-all text-xs text-slate-500">
                Deal reference: {review.dealId}
              </p>
            </article>
          );
        }}
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
