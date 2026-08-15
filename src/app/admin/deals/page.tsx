import { AdminSection } from "@/components/admin-section";
import { CursorPagination } from "@/components/cursor-pagination";
import { Card, EmptyState } from "@/components/ui/card";
import { requireCapabilityOrNotFound } from "@/lib/auth/session";
import { getAdminDealsPage } from "@/lib/data/admin";
import { formatMoney } from "@/lib/money";

export default async function AdminDealsPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  await requireCapabilityOrNotFound("deals:review");
  const params = await searchParams;
  const page = await getAdminDealsPage({
    cursor: params.cursor,
    pageSize: 20,
  });

  return (
    <AdminSection
      description="Review current Deal metadata and bounded operational counts. This list does not expose administrative transitions, payment custody, or Deal history."
      title="Deals"
    >
      {page.items.length ? (
        <div className="grid gap-3">
          {page.items.map((deal) => {
            const hiddenParticipants = Math.max(
              0,
              deal.participantCount - deal.participantPreview.length,
            );
            return (
              <Card key={deal.id}>
                <article className="grid gap-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-full bg-[color:var(--px-primary-soft)] px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-[color:var(--px-primary)]">
                          {humanize(deal.status)}
                        </span>
                        <span className="rounded-full bg-[color:var(--px-muted)] px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-[color:var(--px-text-muted)]">
                          {deal.settlementMode === "SIMULATED"
                            ? "Simulated tracking"
                            : "Online payment unavailable"}
                        </span>
                      </div>
                      <h2 className="mt-2 font-bold text-[color:var(--px-text)]">
                        {deal.title}
                      </h2>
                      <p className="mt-2 text-sm text-[color:var(--px-text-muted)]">
                        Agreement value: {formatMoney(deal.valueMinor, deal.currency)}
                      </p>
                      <p className="mt-1 break-all text-xs font-semibold text-[color:var(--px-text-muted)]">
                        Deal reference: {deal.id}
                      </p>
                    </div>
                    <p className="text-xs text-[color:var(--px-text-muted)]">
                      Updated {deal.updatedAt.toLocaleString()}
                    </p>
                  </div>

                  <p className="text-sm text-[color:var(--px-text-muted)]">
                    {deal.participantCount} participants · {deal.milestoneCount} milestones ·{" "}
                    {deal.unresolvedDisputeCount} unresolved disputes
                  </p>
                  <div className="flex flex-wrap gap-2 text-xs text-[color:var(--px-text-muted)]">
                    {deal.participantPreview.map((participant) => (
                      <span
                        className="rounded-full border border-[color:var(--px-border)] px-2.5 py-1"
                        key={`${participant.user.username}:${participant.role}`}
                      >
                        @{participant.user.username} · {humanize(participant.role)}
                      </span>
                    ))}
                    {hiddenParticipants ? (
                      <span className="rounded-full bg-[color:var(--px-muted)] px-2.5 py-1 font-bold">
                        +{hiddenParticipants} more
                      </span>
                    ) : null}
                  </div>
                </article>
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState body="No deals are available for review." title="No deals" />
      )}
      <CursorPagination
        basePath="/admin/deals"
        cursor={page.cursor}
        label="Admin deals pagination"
        nextCursor={page.nextCursor}
      />
    </AdminSection>
  );
}

function humanize(value: string) {
  return value.toLocaleLowerCase().replaceAll("_", " ");
}
