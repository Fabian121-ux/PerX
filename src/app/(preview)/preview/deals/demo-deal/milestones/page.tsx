import { AppSection } from "@/components/app-section";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { previewActiveDeal } from "@/lib/data/preview";
import { formatMoney } from "@/lib/money";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function PreviewMilestonesPage() {
  const deal = previewActiveDeal;

  return (
    <AppSection
      actions={
        <Link className="inline-flex items-center gap-1 text-sm font-semibold text-[color:var(--px-primary)] hover:underline" href={`/preview/deals/${deal.id}`}>
          <ArrowLeft size={16} />
          Back to Deal
        </Link>
      }
      description="Preview Mode: Milestones define the work units that deliveries and approvals are attached to."
      title="Milestones"
    >
      <div className="grid gap-4">
        {deal.milestones.map((milestone) => (
          <Card key={milestone.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-bold text-slate-950 text-base">{milestone.title}</h2>
                <p className="mt-2 text-xs text-slate-600 leading-5">{milestone.description}</p>
              </div>
              <Badge className={
                milestone.status === "RELEASED" 
                  ? "bg-green-100 text-green-800 border-green-200" 
                  : "bg-amber-100 text-amber-800 border-amber-200"
              }>
                {milestone.status.toLowerCase()}
              </Badge>
            </div>
            <p className="mt-4 text-sm font-bold text-slate-950">
              {formatMoney(milestone.amountMinor)} {deal.currency}
            </p>
          </Card>
        ))}
      </div>
    </AppSection>
  );
}
