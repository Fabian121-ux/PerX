/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from "next/link";
import { notFound } from "next/navigation";

import { AppSection } from "@/components/app-section";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/session";
import { getDealForUser } from "@/lib/data/app";
import { formatMoney } from "@/lib/money";

export default async function DealWorkspacePage({
  params,
}: {
  params: Promise<{ dealId: string }>;
}) {
  const { dealId } = await params;
  const user = await getCurrentUser();
  const deal = await getDealForUser(dealId, user!.id);
  if (!deal) notFound();

  return (
    <AppSection
      description="Deal state is controlled by authorised server actions and escrow transitions."
      title={deal.proposal.opportunity.title}
    >
      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <Card>
          <div className="flex flex-wrap items-center gap-2">
            <Badge>{deal.status.toLowerCase().replaceAll("_", " ")}</Badge>
            <Badge>{formatMoney(deal.valueMinor, deal.currency)}</Badge>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <ButtonLink href={`/app/deals/${deal.id}/milestones`} variant="secondary">
              Milestones
            </ButtonLink>
            <ButtonLink href={`/app/deals/${deal.id}/deliveries`} variant="secondary">
              Deliveries
            </ButtonLink>
            <ButtonLink href={`/app/deals/${deal.id}/escrow`} variant="secondary">
              Simulated Escrow Status
            </ButtonLink>
          </div>
          <div className="mt-6 border-t border-slate-100 pt-4">
            <h3 className="text-sm font-semibold text-slate-900">Step-by-step progress</h3>
            <div className="mt-2 flex items-center gap-2">
              <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-800">Proposal accepted</span>
              <span className="text-slate-300">→</span>
              <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-800">Escrow funded</span>
              <span className="text-slate-300">→</span>
              <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">In progress</span>
            </div>
          </div>
        </Card>
        <Card>
          <h2 className="font-semibold text-slate-950">Participants</h2>
          <div className="mt-3 grid gap-2">
            {deal.participants.map((participant: any) => (
              <Link
                className="text-sm text-emerald-700 hover:text-emerald-800"
                href={`/u/${participant.user.username}`}
                key={participant.id}
              >
                {participant.user.name} · {participant.role}
              </Link>
            ))}
          </div>
        </Card>
      </div>
    </AppSection>
  );
}
