import { requireCapabilityOrNotFound } from "@/lib/auth/session";
import { getPrisma } from "@/lib/db/prisma";
import { AdminSection } from "@/components/admin-section";
import { SocialModerationForm } from "@/components/social/moderation-form";

type SocialModerationItem = {
  id: string;
  body: string;
  createdAt: Date;
  moderationStatus: string;
  author: { id: string; name: string; username: string };
  targetType: "post" | "comment";
};

export default async function SocialModerationPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  await requireCapabilityOrNotFound("admin:moderate");
  const { id } = await searchParams;
  const exactId = id?.trim().slice(0, 128);

  // Keep the moderation queue bounded and narrow. Do not fetch every column,
  // reaction, or comment for each item: the queue needs only a short content
  // preview, author identity, status, and timestamp.
  const queueWhere = {
    deletedAt: null,
    ...(exactId
      ? { id: exactId }
      : { moderationStatus: { in: ["PENDING", "FLAGGED"] as const } }),
  };

  const [posts, comments] = await Promise.all([
    getPrisma().post.findMany({
      where: queueWhere,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        body: true,
        createdAt: true,
        moderationStatus: true,
        author: { select: { id: true, name: true, username: true } },
      },
      take: 25,
    }),
    getPrisma().postComment.findMany({
      where: queueWhere,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        body: true,
        createdAt: true,
        moderationStatus: true,
        author: { select: { id: true, name: true, username: true } },
      },
      take: 25,
    }),
  ]);

  const items: SocialModerationItem[] = [
    ...posts.map((post) => ({ ...post, targetType: "post" as const })),
    ...comments.map((comment) => ({
      ...comment,
      targetType: "comment" as const,
    })),
  ].sort(
    (left, right) =>
      right.createdAt.getTime() - left.createdAt.getTime() ||
      right.id.localeCompare(left.id),
  );

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
      </form>
      <p className="mb-3 text-sm text-[color:var(--px-text-muted)]">
        {exactId
          ? "Showing the exact matching post or comment, if it exists."
          : "Showing up to 25 pending posts and 25 pending comments. Search by ID to inspect a specific item."}
      </p>
      {items.length ? (
        <div className="grid gap-4">
          {items.map((item) => (
            <section
              className="min-w-0 rounded-xl border p-4"
              key={`${item.targetType}:${item.id}`}
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
                <a
                  className="font-semibold hover:underline"
                  href={`/admin/users/${item.author.id}`}
                >
                  @{item.author.username}
                </a>
                {" · "}
                {item.author.name}
                {" · "}
                {item.id}
              </p>
              <p className="my-3 whitespace-pre-wrap break-words text-sm">
                {item.body}
              </p>
              {item.moderationStatus !== "REJECTED" ? (
                <SocialModerationForm
                  targetId={item.id}
                  targetType={item.targetType}
                />
              ) : (
                <p className="text-xs text-[color:var(--px-text-muted)]">
                  This content has already been rejected.
                </p>
              )}
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
    </AdminSection>
  );
}
