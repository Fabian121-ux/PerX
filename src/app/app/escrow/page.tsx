import { AppSection } from "@/components/app-section";
import { getCurrentUser } from "@/lib/auth/session";
import { getPrisma } from "@/lib/db/prisma";
import { Card, EmptyState } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/money";

export default async function EscrowPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const deals = await getPrisma().deal.findMany({
    where: {
      participants: { some: { userId: user.id } },
      status: { notIn: ["DRAFT", "CANCELLED"] }
    },
    include: { proposal: { include: { opportunity: true } } },
    orderBy: { updatedAt: "desc" }
  });

  return (
    <AppSection
      title="Escrow Dashboard"
      description="Track the status of funds tied to active deals and milestones."
    >
      <div className="mb-8 rounded-2xl bg-[color:var(--px-warning)]/10 border border-[color:var(--px-warning)]/20 p-5">
        <h3 className="font-bold text-[color:var(--px-warning)]">Beta Simulation Notice</h3>
        <p className="mt-2 text-sm text-[color:var(--px-text-muted)]">
          Payment and escrow functionality is not active during this beta. No real funds are collected or held by perX. The records shown below reflect simulated deal states for workflow testing only.
        </p>
      </div>

      <div>
        <h3 className="mb-4 text-lg font-bold text-[color:var(--px-text)]">Active & Past Deals in Escrow</h3>
        {deals.length > 0 ? (
          <div className="grid gap-4">
            {deals.map(deal => (
              <Card key={deal.id} className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h4 className="font-semibold text-[color:var(--px-text)]">{deal.proposal.opportunity.title}</h4>
                  <p className="mt-1 text-sm text-[color:var(--px-text-muted)]">Deal ID: {deal.id}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-[color:var(--px-text)]">{formatMoney(deal.valueMinor, deal.currency)}</span>
                    <Badge className={
                      deal.status === "AWAITING_FUNDING" ? "bg-amber-100 text-amber-800" :
                      deal.status === "FUNDED" ? "bg-blue-100 text-blue-800" :
                      deal.status === "RELEASED" ? "bg-emerald-100 text-emerald-800" :
                      "bg-slate-100 text-slate-800"
                    }>
                      {deal.status} (Simulated)
                    </Badge>
                  </div>
                  <p className="text-xs text-[color:var(--px-text-muted)]">Last updated {new Date(deal.updatedAt).toLocaleDateString()}</p>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No deals in escrow"
            body="You have no active or past deals with funds in escrow."
          />
        )}
      </div>
    </AppSection>
  );
}
