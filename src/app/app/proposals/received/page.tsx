import { AppSection } from "@/components/app-section";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, EmptyState } from "@/components/ui/card";
import { acceptProposalAction } from "@/features/proposals/actions";
import { getCurrentUser } from "@/lib/auth/session";
import { getUserProposals } from "@/lib/data/app";
import { formatMoney } from "@/lib/money";

export default async function ProposalsReceivedPage() {
  const user = await getCurrentUser();
  const proposals = await getUserProposals(user!.id, "received");

  return (
    <AppSection description="Accepting a proposal creates a deal workspace with milestones and escrow state tracking." title="Proposals received">
      {proposals.length ? (
        <div className="grid gap-4">
          {proposals.map((proposal) => (
            <Card key={proposal.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-slate-950">{proposal.opportunity.title}</h2>
                  <p className="mt-2 text-sm text-slate-600">{proposal.description}</p>
                  <p className="mt-3 text-sm font-semibold text-slate-950">{formatMoney(proposal.amountMinor, proposal.currency)}</p>
                </div>
                <Badge>{proposal.status.toLowerCase()}</Badge>
              </div>
              {proposal.status === "SENT" ? (
                <form action={acceptProposalAction} className="mt-4">
                  <input name="proposalId" type="hidden" value={proposal.id} />
                  <Button type="submit">Accept and create deal</Button>
                </form>
              ) : null}
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState body="Proposals for your opportunities will appear here." title="No received proposals" />
      )}
    </AppSection>
  );
}
