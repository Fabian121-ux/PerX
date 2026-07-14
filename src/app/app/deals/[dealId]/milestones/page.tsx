/* eslint-disable @typescript-eslint/no-explicit-any */
import { notFound } from "next/navigation";

import { AppSection } from "@/components/app-section";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/session";
import { getDealForUser } from "@/lib/data/app";
import { formatMoney } from "@/lib/money";

export default async function MilestonesPage({ params }: { params: Promise<{ dealId: string }> }) {
  const { dealId } = await params;
  const user = await getCurrentUser();
  const deal = await getDealForUser(dealId, user!.id);
  if (!deal) notFound();

  return (
    <AppSection description="Milestones define the work units that deliveries and approvals are attached to." title="Milestones">
      <div className="grid gap-4">
        {deal.proposal.opportunity.milestones?.map((milestone: any) => (
          <Card key={milestone.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold text-slate-950">{milestone.title}</h2>
                <p className="mt-2 text-sm text-slate-600">{milestone.description}</p>
              </div>
              <Badge>{milestone.status.toLowerCase()}</Badge>
            </div>
            <p className="mt-3 text-sm font-semibold text-slate-950">{formatMoney(milestone.amountMinor, milestone.currency)}</p>
          </Card>
        ))}
      </div>
    </AppSection>
  );
}
