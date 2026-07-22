import { AppSection } from "@/components/app-section";
import { getCurrentUser } from "@/lib/auth/session";
import { getPrisma } from "@/lib/db/prisma";
import { Card, EmptyState } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/money";

export default async function WalletPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const deals = await getPrisma().deal.findMany({
    where: {
      participants: { some: { userId: user.id } },
      status: "RELEASED"
    },
    include: { proposal: { include: { opportunity: true } } },
    orderBy: { updatedAt: "desc" }
  });

  return (
    <AppSection
      title="Wallet"
      description="Manage your earnings and payouts."
    >
      <div className="mb-8 rounded-2xl bg-[color:var(--px-primary-soft)] border border-[color:var(--px-primary)]/20 p-5">
        <h3 className="font-bold text-[color:var(--px-text)]">Beta Information</h3>
        <p className="mt-2 text-sm text-[color:var(--px-text-muted)]">
          Financial custody and wallet functionality are inactive during this beta. No real funds are collected, held, transferred, or released by perX. Wallet records will stay unavailable until compliant payment infrastructure is connected.
        </p>
      </div>

      <div>
        <h3 className="mb-4 text-lg font-bold text-[color:var(--px-text)]">Completed Deals History</h3>
        {deals.length > 0 ? (
          <div className="grid gap-4">
            {deals.map(deal => (
              <Card key={deal.id} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold text-[color:var(--px-text)]">{deal.proposal.opportunity.title}</p>
                  <p className="text-sm text-[color:var(--px-text-muted)]">Completed on {new Date(deal.updatedAt).toLocaleDateString()}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-bold text-[color:var(--px-text)]">{formatMoney(deal.valueMinor, deal.currency)}</span>
                  <Badge className="bg-emerald-100 text-emerald-800">Paid out (Simulated)</Badge>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No completed deals"
            body="You have no completed deal history yet. Participate in opportunities to build your track record."
          />
        )}
      </div>
    </AppSection>
  );
}
