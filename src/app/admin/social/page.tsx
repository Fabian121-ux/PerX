import { requireCapabilityOrNotFound } from "@/lib/auth/session";
import { getPrisma } from "@/lib/db/prisma";
import { AdminSection } from "@/components/admin-section";
import { SocialModerationForm } from "@/components/social/moderation-form";
export default async function SocialModerationPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  await requireCapabilityOrNotFound("admin:moderate");
  const { id } = await searchParams;
  const [posts, comments] = await Promise.all([
    getPrisma().post.findMany({
      where: { deletedAt: null, ...(id ? { id } : {}) },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    getPrisma().postComment.findMany({
      where: { deletedAt: null, ...(id ? { id } : {}) },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);
  return (
    <AdminSection
      title="Social moderation"
      description="Hide social posts or comments. Every decision requires a reason and an atomic audit record."
    >
      <form className="mb-4 flex flex-wrap gap-2">
        <label>
          Content ID
          <input
            className="mx-2 rounded border p-2"
            name="id"
            maxLength={128}
            defaultValue={id}
          />
        </label>
        <button type="submit">Find content</button>
      </form>
      <div className="grid gap-4">
        {[
          ...posts.map((p) => ({ ...p, targetType: "post" as const })),
          ...comments.map((p) => ({ ...p, targetType: "comment" as const })),
        ].map((item) => (
          <section
            className="min-w-0 rounded-xl border p-4"
            key={`${item.targetType}:${item.id}`}
          >
            <p className="text-xs">
              {item.targetType} · {item.id} · {item.moderationStatus}
            </p>
            <p className="my-3 whitespace-pre-wrap break-words">{item.body}</p>
            <SocialModerationForm
              targetId={item.id}
              targetType={item.targetType}
            />
          </section>
        ))}
      </div>
    </AdminSection>
  );
}
