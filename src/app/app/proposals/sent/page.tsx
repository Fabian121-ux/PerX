/* eslint-disable @typescript-eslint/no-explicit-any */
import { AppSection } from "@/components/app-section";
import { Badge } from "@/components/ui/badge";
import { Card, EmptyState } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/session";
import { getUserProposals } from "@/lib/data/app";
import { formatMoney } from "@/lib/money";

export default async function ProposalsSentPage() {
  const user = await getCurrentUser();
  const proposals = await getUserProposals(user!.id, "sent");

  return (
    <AppSection description="Sent proposals include structured amounts, timelines, revisions, milestones, and status history." title="Proposals sent">
      {proposals.length ? (
        <div className="grid gap-4">
          {proposals.map((proposal: any) => (
            <Card key={proposal.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-slate-950">{proposal.opportunity.title}</h2>
                  <p className="mt-2 text-sm text-slate-600">{proposal.description}</p>
                </div>
                <Badge 
                  className={
                    proposal.status === "DRAFT" ? "bg-slate-100 text-slate-800 hover:bg-slate-200" :
                    proposal.status === "SUBMITTED" ? "bg-blue-100 text-blue-800 hover:bg-blue-200" :
                    proposal.status === "ACCEPTED" ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200" :
                    proposal.status === "REJECTED" ? "bg-rose-100 text-rose-800 hover:bg-rose-200" :
                    ""
                  }
                >
                  {proposal.status.charAt(0) + proposal.status.slice(1).toLowerCase()}
                </Badge>
              </div>
              <p className="mt-4 text-sm font-semibold text-slate-950">{formatMoney(proposal.amountMinor, proposal.currency)}</p>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState body="Submit a proposal from an opportunity detail page." title="No sent proposals" />
      )}
    </AppSection>
  );
}
