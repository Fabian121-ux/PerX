import Link from "next/link";

import { AdminSection } from "@/components/admin-section";
import { CursorPagination } from "@/components/cursor-pagination";
import { requireCapabilityOrNotFound } from "@/lib/auth/session";
import { getPrisma } from "@/lib/db/prisma";
import {
  createCursorPage,
  normalizeCursorPageParams,
} from "@/lib/data/cursor";
import type { Prisma } from "@/generated/prisma/client";

type SocialModerationItem = {
  id: string;
  targetId: string;
  targetType: "post" | "comment";
  body: string;
  createdAt: Date;
  moderationStatus: string;
  author: { id: string; name: string; username: string };
};

export default async function SocialModerationPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; cursor?: string }>;
}) {
  await requireCapabilityOrNotFound("admin:moderate");
  const params = await searchParams;
  const exactId = params.id?.trim().slice(0, 128);
  const scope = "admin:social-moderation";
  const { cursor, pageSize, requestedCursor } = normalizeCursorPageParams(
    { cursor: exactId ? undefined : params.cursor, pageSize: 20 },
    scope,
  );

  // Cursor ID is namespaced because posts and comments live in separate
  // canonical tables and can theoretically share the same ID.
  let cursorType: "post" | "comment" | null = null;
  let cursorRecordId: string | null = null;
  if (cursor) {
    const separator = cursor.id.indexOf(":");
    const type = cursor.id.slice(0, separator);
    const recordId = cursor.id.slice(separator + 1);
    if (
      separator < 1 ||
      (type !== "post" && type !== "comment") ||
      !recordId
    ) {
      throw new Error("Invalid social moderation cursor.");
    }
    cursorType = type;
    cursorRecordId = recordId;
  }

  const afterCursor = (targetType: "post" | "comment") => {
    if (!cursor || !cursorRecordId || !cursorType) return undefined;
    return {
      OR: [
        { createdAt: { lt: cursor.timestamp } },
        { createdAt: cursor.timestamp, id: { lt: cursorRecordId } },
        ...(targetType < cursorType
          ? [{ createdAt: cursor.timestamp, id: cursorRecordId }]
          : []),
      ],
    };
  };

  const statusFilter: Pick<Prisma.PostWhereInput, "moderationStatus"> =
    exactId
      ? {}
      : { moderationStatus: { in: ["PENDING", "FLAGGED"] } };

  // Keep the queue bounded and narrow. Do not fetch every column, reactions,
  // comments, or arbitrary related data for a moderation summary.
  const postWhere: Prisma.PostWhereInput = {
    deletedAt: null,
    ...statusFilter,
    ...(exactId ? { id: exactId } : {}),
    ...(afterCursor("post")
      ? { AND: [afterCursor("post") as Prisma.PostWhereInput] }
      : {}),
  };
  const commentWhere: Prisma.PostCommentWhereInput = {
    deletedAt: null,
    ...statusFilter,
    ...(exactId ? { id: exactId } : {}),
    ...(afterCursor("comment")
      ? { AND: [afterCursor("comment") as Prisma.PostCommentWhereInput] }
      : {}),
  };

  const [posts, comments] = await Promise.all([
    getPrisma().post.findMany({
      where: postWhere,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        body: true,
        createdAt: true,
        moderationStatus: true,
        author: { select: { id: true, name: true, username: true } },
      },
      take: pageSize + 1,
    }),
    getPrisma().postComment.findMany({
      where: commentWhere,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        body: true,
        createdAt: true,
        moderationStatus: true,
        author: { select: { id: true, name: true, username: true } },
      },
      take: pageSize + 1,
    }),
  ]);

  const merged: SocialModerationItem[] = [
    ...posts.map((post) => ({
      ...post,
      id: `post:${post.id}`,
      targetId: post.id,
      targetType: "post" as const,
    })),
    ...comments.map((comment) => ({
      ...comment,
      id: `comment:${comment.id}`,
      targetId: comment.id,
      targetType: "comment" as const,
    })),
  ].sort(
    (left, right) =>
      right.createdAt.getTime() - left.createdAt.getTime() ||
      right.targetId.localeCompare(left.targetId) ||
      right.targetType.localeCompare(left.targetType),
  );

  const hasNextPage = !exactId && merged.length > pageSize;
  const items = hasNextPage ? merged.slice(0, pageSize) : merged;
  const page = createCursorPage(items, {
    cursor: requestedCursor,
    getTimestamp: (item) => item.createdAt,
    hasNextPage,
    nextCursorItem: items.at(-1),
    pageSize,
    scope,
  });

  return (
    <AdminSection
      title="Social moderation"
      description="Review pending and flagged posts and comments. Every moderation decision requires a reason and writes to the shared audit log."
    >
      <form className="mb-4 flex flex-wrap items-end gap-2">
        <label className="grid gap-1 text-sm">
          Find content by ID
          <input
            className="min-h-11 min-w-0 rounded-lg border p-2"
            name="id"
            maxLength={128}
            defaultValue={exactId}
          />
        </label>
        <button
          className="min-h-11 rounded-lg border px-4 font-semibold"
          type="submit"
        >
          Find content
        </button>
        {exactId ? (
          <Link
            className="inline-flex min-h-11 items-center rounded-lg border px-4 text-sm font-semibold"
            href="/admin/social"
          >
            Clear search
          </Link>
        ) : null}
      </form>
      <p className="mb-3 text-sm text-[color:var(--px-text-muted)]">
        {exactId
          ? "Showing the exact matching post or comment, if it exists."
          : "Pending and flagged content only. Results are cursor-paginated to keep database reads and response sizes bounded."}
      </p>
      {items.length ? (
        <div className="grid gap-4">
          {items.map((item) => (
            <section
              className="min-w-0 rounded-xl border p-4"
              key={item.id}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide">
                  {item.targetType} · {item.moderationStatus}
                </p>
                <time
                  className="text-xs text-[color:var(--px-text-muted)]"
                  dateTime={item.createdAt.toISOString()}
                >
                  {item.createdAt.toLocaleString()}
                </time>
              </div>
              <p className="mt-1 text-xs text-[color:var(--px-text-muted)]">
                <Link
                  className="font-semibold hover:underline"
                  href={`/admin/users/${item.author.id}`}
                >
                  @{item.author.username}
                </Link>
                {" · "}
                {item.author.name}
                {" · "}
                {item.targetId}
              </p>
              <p className="my-3 whitespace-pre-wrap break-words text-sm">
                {item.body}
              </p>
              <SocialModerationForm
                targetId={item.targetId}
                targetType={item.targetType}
              />
            </section>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border p-6 text-sm text-[color:var(--px-text-muted)]">
          {exactId
            ? "No matching content was found."
            : "The social moderation queue is clear."}
        </div>
      )}
      {!exactId ? (
        <CursorPagination
          basePath="/admin/social"
          cursor={page.cursor}
          label="Social moderation pagination"
          nextCursor={page.nextCursor}
        />
      ) : null}
    </AdminSection>
  );
}
