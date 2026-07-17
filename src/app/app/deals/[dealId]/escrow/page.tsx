/* eslint-disable @typescript-eslint/no-explicit-any */
import { notFound } from "next/navigation";

import { AppSection } from "@/components/app-section";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/session";
import { getDealForUser } from "@/lib/data/app";
import { formatMoney } from "@/lib/money";

export default async function EscrowPage({ params }: { params: Promise<{ dealId: string }> }) {
  const { dealId } = await params;
  const user = await getCurrentUser();
  const deal = await getDealForUser(dealId, user!.id);
  if (!deal) notFound();

  return (
    <AppSection description="Payment and escrow functionality is not active during this beta. No real funds are collected or held by perX; this page only shows simulated deal-state records." title="Simulated escrow status">
      <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
        <Card>
          <p className="text-sm font-medium text-slate-500">Current state</p>
          <p className="mt-2 text-3xl font-black text-slate-950">{deal.status.replaceAll("_", " ").toLowerCase()}</p>
          <p className="mt-3 text-sm font-semibold text-slate-950">{formatMoney(deal.valueMinor, deal.currency)}</p>
        </Card>
        <Card>
          <h2 className="font-semibold text-slate-950">Status history</h2>
          <div className="mt-4 grid gap-3">
            {deal.statusHistory.map((entry: any) => (
              <div className="flex flex-wrap items-center gap-2 rounded-md bg-slate-50 p-3 text-sm" key={entry.id}>
                <Badge>{entry.toStatus.toLowerCase()}</Badge>
                <span className="text-slate-600">{entry.reason ?? "State changed"}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </AppSection>
  );
}
