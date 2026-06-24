import { AppSection } from "@/components/app-section";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { previewActiveDeal } from "@/lib/data/preview";
import { formatMoney } from "@/lib/money";
import Link from "next/link";

export default function PreviewDealWorkspacePage() {
  const deal = previewActiveDeal;

  return (
    <AppSection description="Preview Mode: Deal state is controlled by simulated independent escrow transitions." title={deal.title}>
      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="grid gap-6">
          <Card>
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <Badge className="bg-green-100 text-green-800 border-green-200">
                {deal.status.replaceAll("_", " ").toLowerCase()}
              </Badge>
              <Badge>
                {formatMoney(deal.valueMinor)} {deal.currency}
              </Badge>
            </div>
            
            <p className="text-xs text-[color:var(--px-text-muted)] leading-5">
              Fictional contract between Riley, Sam, Alex and Maya. Manage the milestones and verify funding ledger events.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <ButtonLink href={`/preview/deals/${deal.id}/milestones`} variant="secondary">
                Milestones
              </ButtonLink>
              <ButtonLink href={`/preview/deals/${deal.id}/escrow`} variant="secondary">
                Escrow status
              </ButtonLink>
            </div>
          </Card>

          {/* Deliveries card */}
          <Card>
            <h2 className="text-lg font-bold text-slate-950 mb-3">Deliveries</h2>
            <div className="grid gap-3">
              {deal.deliveries.map((delivery) => (
                <div key={delivery.id} className="border border-slate-100 rounded-lg p-4 bg-slate-50 text-xs">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-bold text-slate-950">{delivery.title}</span>
                    <span className="rounded bg-green-100 text-green-800 px-2 py-0.5 font-semibold text-[10px]">
                      {delivery.status.toLowerCase()}
                    </span>
                  </div>
                  <p className="text-slate-600 leading-5">Notes: {delivery.notes}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div>
          <Card className="grid gap-4">
            <h2 className="font-bold text-slate-950 text-base">Participants</h2>
            <div className="grid gap-3">
              {deal.participants.map((participant) => (
                <div className="flex items-center gap-2 text-xs" key={participant.id}>
                  <div className="grid h-8 w-8 place-items-center rounded-full bg-slate-100 text-slate-700 font-bold">
                    {participant.name.split(" ").map(n => n[0]).join("")}
                  </div>
                  <div>
                    <Link className="font-bold text-[color:var(--px-primary)] hover:underline" href="/preview/profile">
                      {participant.name}
                    </Link>
                    <p className="text-[10px] text-[color:var(--px-text-muted)]">{participant.role}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </AppSection>
  );
}
