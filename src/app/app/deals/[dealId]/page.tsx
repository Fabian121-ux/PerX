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
import { getPaymentReadiness } from "@/lib/payments/service";

export default async function DealWorkspacePage({
  params,
}: {
  params: Promise<{ dealId: string }>;
}) {
  const { dealId } = await params;
  const user = await getCurrentUser();
  const deal = await getDealForUser(dealId, user!.id);
  if (!deal) notFound();
  const paymentReadiness = getPaymentReadiness();
  const simulated = deal.settlementMode === "SIMULATED";

  return (
    <AppSection
      description={
        simulated
          ? "This legacy Deal uses simulated state tracking. No real funds are collected, held, transferred, or released by PerX."
          : "Payments are currently unavailable. This Deal records agreed terms but does not hold funds."
      }
      title={deal.proposal.opportunity.title}
    >
      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <Card>
          <div className="flex flex-wrap items-center gap-2">
            <Badge>{deal.status.toLowerCase().replaceAll("_", " ")}</Badge>
            <Badge>{formatMoney(deal.valueMinor, deal.currency)}</Badge>
            <Badge>{simulated ? "simulated tracking" : "payment unavailable"}</Badge>
          </div>
          <p className="mt-3 break-all text-xs font-semibold text-[color:var(--px-text-muted)]">
            Deal reference: {deal.id}
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <ButtonLink
              href={`/app/deals/${deal.id}/milestones`}
              variant="secondary"
            >
              Milestones
            </ButtonLink>
            <ButtonLink
              href={`/app/deals/${deal.id}/deliveries`}
              variant="secondary"
            >
              Deliveries
            </ButtonLink>
            <ButtonLink
              href={`/app/deals/${deal.id}/escrow`}
              variant="secondary"
            >
              Agreement state
            </ButtonLink>
          </div>
          <div className="mt-6 border-t border-[color:var(--px-border)] pt-4">
            <h3 className="text-sm font-semibold text-[color:var(--px-text)]">
              Step-by-step progress
            </h3>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {deal.statusHistory.map((entry: any) => (
                <span
                  className="rounded-full bg-[color:var(--px-primary-soft)] px-2 py-1 text-xs font-bold text-[color:var(--px-primary)]"
                  key={entry.id}
                >
                  {entry.toStatus.toLowerCase().replaceAll("_", " ")}
                </span>
              ))}
            </div>
          </div>
        </Card>
        <div className="grid gap-5">
          <Card>
            <h2 className="font-semibold text-[color:var(--px-text)]">
              Participants
            </h2>
            <div className="mt-3 grid gap-2">
              {deal.participants.map((participant: any) => (
                <Link
                  className="text-sm font-semibold text-[color:var(--px-primary)] hover:text-[color:var(--px-primary-strong)]"
                  href={`/u/${participant.user.username}`}
                  key={participant.id}
                >
                  {participant.user.name} / {participant.role}
                </Link>
              ))}
            </div>
          </Card>
          <Card>
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[color:var(--px-text-muted)]">
              Payment readiness
            </p>
            <h2 className="mt-1 font-black text-[color:var(--px-text)]">
              {paymentReadiness.available ? "Provider available" : "Online payment unavailable"}
            </h2>
            <p className="mt-2 text-sm leading-6 text-[color:var(--px-text-muted)]">
              {paymentReadiness.message}
            </p>
            <p className="mt-3 rounded-xl bg-[color:var(--px-muted)] p-3 text-xs font-semibold leading-5 text-[color:var(--px-text-muted)]">
              A future provider adapter must verify signed webhooks before any payment event can affect Deal state.
            </p>
          </Card>
        </div>
      </div>
    </AppSection>
  );
}
