/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from "next/link";

import { AppSection } from "@/components/app-section";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/session";
import { getUserDeals } from "@/lib/data/app";
import { formatMoney } from "@/lib/money";

export default async function DealsPage() {
  const user = await getCurrentUser();
  const deals = await getUserDeals(user!.id);

  return (
    <AppSection
      description="Track accepted proposals, milestones, deliveries, approvals, and simulated escrow state."
      title="Deals"
    >
      {deals.length ? (
        <div className="grid gap-5 xl:grid-cols-2">
          {deals.map((deal: any) => (
            <Card className="flex flex-col justify-between gap-5" key={deal.id}>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>
                    {deal.status.toLowerCase().replaceAll("_", " ")}
                  </Badge>
                  <Badge>{formatMoney(deal.valueMinor, deal.currency)}</Badge>
                </div>
                <Link
                  className="mt-4 block text-lg font-black text-[color:var(--px-text)] hover:text-[color:var(--px-primary)]"
                  href={`/deals/${deal.id}`}
                >
                  {getDealTitle(deal)}
                </Link>
                <p className="mt-2 text-sm leading-6 text-[color:var(--px-text-muted)]">
                  {deal.participants.length} participants with authorised
                  deal-state tracking.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <ButtonLink
                  href={`/deals/${deal.id}`}
                  size="sm"
                  variant="secondary"
                >
                  Milestones
                </ButtonLink>
                <ButtonLink
                  href={`/deals/${deal.id}`}
                  size="sm"
                  variant="secondary"
                >
                  Deliveries
                </ButtonLink>
                <ButtonLink
                  href={`/deals/${deal.id}`}
                  size="sm"
                  variant="secondary"
                >
                  Escrow
                </ButtonLink>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          action={<ButtonLink href="/market">Open market</ButtonLink>}
          body="Accepted proposals become deal workspaces here."
          title="No deals yet"
        />
      )}
    </AppSection>
  );
}

function getDealTitle(deal: Awaited<ReturnType<typeof getUserDeals>>[number]) {
  if ("title" in deal && typeof deal.title === "string") {
    return deal.title;
  }

  return deal.proposal.opportunity.title;
}
