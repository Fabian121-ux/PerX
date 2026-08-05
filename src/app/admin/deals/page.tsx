import { AdminSection } from "@/components/admin-section";
import { Card, EmptyState } from "@/components/ui/card";
import { formatMoney } from "@/lib/money";
import { getPrisma } from "@/lib/db/prisma";
import { requireCapabilityOrNotFound } from "@/lib/auth/session";

export default async function AdminDealsPage() {
  await requireCapabilityOrNotFound("deals:review");
  const deals = await getPrisma().deal.findMany({
    select: {
      currency: true,
      id: true,
      participants: {
        select: {
          role: true,
          user: { select: { name: true, username: true } },
        },
        take: 6,
      },
      proposal: { select: { opportunity: { select: { title: true } } } },
      status: true,
      updatedAt: true,
      valueMinor: true,
    },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });

  return (
    <AdminSection
      description="Review deal metadata and simulated escrow states. Real custody and transfers are inactive during beta."
      title="Deals"
    >
      {deals.length ? (
        <div className="grid gap-3">
          {deals.map((deal) => (
            <Card key={deal.id}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-[color:var(--px-primary)]">
                    {deal.status}
                  </p>
                  <h2 className="mt-1 font-bold text-[color:var(--px-text)]">
                    {deal.proposal.opportunity.title}
                  </h2>
                  <p className="mt-2 text-sm text-[color:var(--px-text-muted)]">
                    {formatMoney(deal.valueMinor, deal.currency)} · Participants:{" "}
                    {deal.participants
                      .map((participant) => participant.user.username || participant.user.name)
                      .join(", ")}
                  </p>
                </div>
                <p className="text-xs text-[color:var(--px-text-muted)]">
                  Updated {deal.updatedAt.toLocaleString()}
                </p>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState body="No deals are available for review." title="No deals" />
      )}
    </AdminSection>
  );
}
