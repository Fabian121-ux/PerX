import { AppSection } from "@/components/app-section";
import { Badge } from "@/components/ui/badge";
import { Card, EmptyState } from "@/components/ui/card";
import { previewProposals } from "@/lib/data/preview";
import { formatMoney } from "@/lib/money";
import Link from "next/link";

export default function PreviewProposalsSentPage() {
  const sentProposals = previewProposals.filter((p) => p.senderId === "alex-demo");

  return (
    <AppSection description="Preview Mode: Sent proposals include structured amounts, timelines, revisions, milestones, and status history." title="Proposals">
      {/* Tabs */}
      <div className="flex gap-4 border-b border-slate-100 pb-3 mb-6">
        <Link className="text-sm font-bold text-[color:var(--px-primary)] border-b-2 border-[color:var(--px-primary)] pb-3 -mb-3.5" href="/preview/proposals/sent">
          Sent ({sentProposals.length})
        </Link>
        <Link className="text-sm font-semibold text-[color:var(--px-text-muted)] hover:text-[color:var(--px-text)] pb-3" href="/preview/proposals/received">
          Received (1)
        </Link>
      </div>

      {sentProposals.length ? (
        <div className="grid gap-4">
          {sentProposals.map((proposal) => (
            <Card key={proposal.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-bold text-slate-950 text-lg">{proposal.opportunity.title}</h2>
                  <p className="mt-2 text-sm text-slate-600 leading-6">{proposal.description}</p>
                </div>
                <Badge className="bg-green-50 text-green-800 border-green-200">
                  {proposal.status.toLowerCase()}
                </Badge>
              </div>

              <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap justify-between items-center text-xs">
                <span className="font-bold text-slate-950 text-sm">
                  {formatMoney(proposal.amountMinor)} {proposal.currency}
                </span>
                <span className="text-[color:var(--px-text-muted)]">
                  Delivery in {proposal.deliveryDays} days · {proposal.revisions} revisions
                </span>
              </div>

              {/* Milestones list */}
              <div className="mt-4 pt-4 border-t border-slate-100">
                <h3 className="text-xs font-bold text-slate-950 uppercase tracking-wide mb-2">Milestones ({proposal.milestones.length})</h3>
                <div className="grid gap-2">
                  {proposal.milestones.map((m) => (
                    <div key={m.id} className="flex justify-between items-center text-xs bg-slate-50 p-2.5 rounded border border-slate-100">
                      <div>
                        <span className="font-bold text-slate-900">{m.title}</span>
                        <p className="text-[11px] text-[color:var(--px-text-muted)] mt-0.5">{m.description}</p>
                      </div>
                      <span className="font-semibold text-slate-800">{formatMoney(m.amountMinor)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState body="Submit a proposal from an opportunity detail page." title="No sent proposals" />
      )}
    </AppSection>
  );
}
