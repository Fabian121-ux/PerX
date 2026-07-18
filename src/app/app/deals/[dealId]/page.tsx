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
      description="Agreement state is controlled by authorised server actions and simulated release-state transitions. No real funds are collected or held by perX during beta."
      title={deal.proposal.opportunity.title}
    >
      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <Card>
          <div className="flex flex-wrap items-center gap-2">
            <Badge>{deal.status.toLowerCase().replaceAll("_", " ")}</Badge>
            <Badge>{formatMoney(deal.valueMinor, deal.currency)}</Badge>
          </div>
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
              Simulated State
            </ButtonLink>
          </div>
          <div className="mt-6 border-t border-[color:var(--px-border)] pt-4">
            <h3 className="text-sm font-semibold text-[color:var(--px-text)]">
              Step-by-step progress
            </h3>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-green-500/10 px-2 py-1 text-xs font-medium text-[color:var(--px-success)]">
                Proposal accepted
              </span>
              <span className="text-[color:var(--px-text-muted)]">/</span>
              <span className="rounded-full bg-green-500/10 px-2 py-1 text-xs font-medium text-[color:var(--px-success)]">
                Simulated funding recorded
              </span>
              <span className="text-[color:var(--px-text-muted)]">/</span>
              <span className="rounded-full bg-[color:var(--px-muted)] px-2 py-1 text-xs font-medium text-[color:var(--px-text-muted)]">
                In progress
              </span>
            </div>
          </div>
        </Card>
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
      </div>
    </AppSection>
  );
}
