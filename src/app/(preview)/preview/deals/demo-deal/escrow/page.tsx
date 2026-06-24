import { AppSection } from "@/components/app-section";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { previewActiveDeal } from "@/lib/data/preview";
import { formatMoney } from "@/lib/money";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function PreviewEscrowPage() {
  const deal = previewActiveDeal;

  return (
    <AppSection
      actions={
        <Link className="inline-flex items-center gap-1 text-sm font-semibold text-[color:var(--px-primary)] hover:underline" href={`/preview/deals/${deal.id}`}>
          <ArrowLeft size={16} />
          Back to Deal
        </Link>
      }
      description="Preview Mode: Independent simulated escrow records funding, approvals, releases, and disputes."
      title="Escrow status"
    >
      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <div className="grid gap-6 self-start">
          <Card className="p-5">
            <p className="text-xs font-semibold text-[color:var(--px-text-muted)] uppercase tracking-wide">Current state</p>
            <p className="mt-2 text-2xl font-black text-slate-950 capitalize">{deal.status.replaceAll("_", " ").toLowerCase()}</p>
            <p className="mt-4 text-xs font-bold text-slate-900">Total Contract Value:</p>
            <p className="text-lg font-black text-[color:var(--px-primary)]">{formatMoney(deal.valueMinor, deal.currency)}</p>
          </Card>

          <Card className="p-5 grid gap-3">
            <h3 className="font-bold text-slate-950 text-sm">Ledger balance</h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-[color:var(--px-text-muted)]">Held in Escrow:</span>
                <span className="font-bold text-slate-900">{formatMoney(20000000, deal.currency)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[color:var(--px-text-muted)]">Released to Pro:</span>
                <span className="font-bold text-green-700">{formatMoney(44000000, deal.currency)}</span>
              </div>
            </div>
          </Card>
        </div>

        <div className="grid gap-6">
          {/* Ledger Entries */}
          <Card>
            <h2 className="text-lg font-bold text-slate-950 mb-3">Escrow Ledger History</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50 text-[color:var(--px-text-muted)] font-bold">
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3">Description</th>
                    <th className="py-2.5 px-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {deal.ledgerEntries.map((entry) => (
                    <tr key={entry.id}>
                      <td className="py-3 px-3">
                        <Badge className={
                          entry.type === "RELEASE" 
                            ? "bg-green-50 text-green-800 border-green-200" 
                            : "bg-amber-50 text-amber-800 border-amber-200"
                        }>
                          {entry.type.replaceAll("_", " ").toLowerCase()}
                        </Badge>
                      </td>
                      <td className="py-3 px-3 text-slate-700">{entry.note}</td>
                      <td className={`py-3 px-3 text-right font-bold ${
                        entry.type === "RELEASE" ? "text-green-700" : "text-slate-900"
                      }`}>
                        {entry.type === "RELEASE" ? "-" : ""}{formatMoney(entry.amountMinor, entry.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Status History */}
          <Card>
            <h2 className="text-lg font-bold text-slate-950 mb-4">State transitions</h2>
            <div className="relative border-l border-slate-200 ml-4 space-y-5">
              {deal.statusHistory.map((entry) => (
                <div className="relative pl-6" key={entry.id}>
                  <div className="absolute -left-1.5 top-1.5 h-3 w-3 rounded-full border-2 border-white bg-slate-400" />
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <Badge>{entry.toStatus.toLowerCase()}</Badge>
                    <span className="text-slate-600 font-medium">{entry.reason}</span>
                    <span className="text-[10px] text-[color:var(--px-text-muted)] ml-auto">
                      {new Date(entry.createdAt).toLocaleDateString()}
                    </span>
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
