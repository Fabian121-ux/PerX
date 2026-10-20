import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ShieldAlert } from "lucide-react";

import { AppSection } from "@/components/app-section";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/session";
import { getDealForUser } from "@/lib/data/app";
import { formatMoney } from "@/lib/money";

export default async function EscrowPage({ params }: { params: Promise<{ dealId: string }> }) {
  const { dealId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  const deal = await getDealForUser(dealId, user.id);
  if (!deal) notFound();

  return (
    <AppSection
      title="Agreement state timeline"
      description="These steps track a Deal workflow only. This is not a live escrow wallet or proof of payment."
    >
      <div role="note" className="mb-5 flex items-start gap-3 rounded-2xl border border-amber-300 bg-[#fff6df] p-4 text-[#4c3a12] dark:border-amber-500/45 dark:bg-[#3b311b] dark:text-amber-100">
        <ShieldAlert aria-hidden className="mt-0.5 shrink-0" size={22} />
        <p className="text-sm font-semibold leading-6">
          Simulated status only. PtahX does not collect, protect, transfer or release real funds.
          Do not send payment based on a status shown here.
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <Card>
          <p className="text-sm font-bold text-[color:var(--px-text-muted)]">Recorded status</p>
          <h2 className="mt-2 break-words text-2xl font-black capitalize text-[color:var(--px-text)]">
            {deal.status.replaceAll("_", " ").toLowerCase()}
          </h2>
          <Badge className="mt-3 border border-[color:var(--px-border-strong)] bg-[color:var(--px-surface-soft)] text-[color:var(--px-text)]">
            No funds held
          </Badge>
          <p className="mt-4 text-sm font-semibold text-[color:var(--px-text)]">
            Agreed value: {formatMoney(deal.valueMinor, deal.currency)}
          </p>
          <Link href={`/app/deals/${deal.id}`} className="mt-5 inline-flex min-h-11 items-center text-sm font-black text-[color:var(--px-primary-ink)] underline underline-offset-4">
            Return to Deal workspace →
          </Link>
        </Card>
        <Card>
          <h2 className="font-black text-[color:var(--px-text)]">Recorded status history</h2>
          {deal.statusHistory.length ? (
            <ol className="mt-4 grid gap-3">
              {deal.statusHistory.map((entry: { id: string; toStatus: string; reason?: string | null }) => (
                <li className="flex flex-wrap items-start gap-2 rounded-xl border border-[color:var(--px-border)] bg-[color:var(--px-surface-soft)] p-3 text-sm" key={entry.id}>
                  <Badge className="border border-[color:var(--px-border-strong)] bg-[color:var(--px-surface)] text-[color:var(--px-text)]">
                    {entry.toStatus.replaceAll("_", " ").toLowerCase()}
                  </Badge>
                  <span className="min-w-0 flex-1 break-words text-[color:var(--px-text)]">{entry.reason ?? "State updated"}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-4 text-sm text-[color:var(--px-text-muted)]">
              No historical changes have been recorded for this Deal yet.
            </p>
          )}
        </Card>
      </div>
    </AppSection>
  );
}
