import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldAlert } from "lucide-react";

import { AppSection } from "@/components/app-section";
import { getCurrentUser } from "@/lib/auth/session";
import { getPrisma } from "@/lib/db/prisma";
import { Card, EmptyState } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/money";

const PAGE_LIMIT = 30;

/** Bounded and participant-authorized. No real escrow/funds are represented. */
export default async function EscrowPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const deals = await getPrisma().deal.findMany({
    where: {
      participants: { some: { userId: user.id } },
      status: { notIn: ["DRAFT", "CANCELLED"] },
    },
    select: {
      id: true,
      status: true,
      valueMinor: true,
      currency: true,
      updatedAt: true,
      proposal: { select: { opportunity: { select: { title: true } } } },
    },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take: PAGE_LIMIT,
  });

  return (
    <AppSection
      title="Deal agreement states"
      description="Review the latest agreement records. These are not real escrow balances or proof that money has been held."
    >
      <div role="note" className="mb-6 flex items-start gap-3 rounded-2xl border border-amber-300 bg-[#fff6df] p-4 text-[#4c3a12] dark:border-amber-500/45 dark:bg-[#3b311b] dark:text-amber-100">
        <ShieldAlert aria-hidden className="mt-0.5 shrink-0" size={22} />
        <div>
          <h2 className="text-sm font-black">Beta: no real escrow or funds held</h2>
          <p className="mt-1 text-sm leading-6">
            PtahX does not collect, protect, transfer or release money in this feature.
            Status names such as Funded and Released describe simulated workflow records only.
          </p>
        </div>
      </div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-black text-[color:var(--px-text)]">Latest agreement records</h2>
        <Link href="/app/deals" className="inline-flex min-h-11 items-center text-sm font-bold text-[color:var(--px-primary-ink)] underline underline-offset-4">All my Deals →</Link>
      </div>
      {deals.length ? (
        <div className="grid gap-3">
          {deals.map((deal) => (
            <Card key={deal.id} className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div className="min-w-0">
                <h3 className="break-words font-black text-[color:var(--px-text)]">{deal.proposal.opportunity.title}</h3>
                <p className="mt-1 text-xs text-[color:var(--px-text-muted)]">
                  Updated {new Date(deal.updatedAt).toLocaleDateString("en-NG")}
                </p>
                <p className="mt-2 text-sm font-bold text-[color:var(--px-text)]">
                  Agreed value: {formatMoney(deal.valueMinor, deal.currency)} — not held
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="border border-[color:var(--px-border-strong)] bg-[color:var(--px-surface-soft)] text-[color:var(--px-text)]">
                  {deal.status.replaceAll("_", " ").toLowerCase()} · simulated
                </Badge>
                <Link href={`/app/deals/${deal.id}/escrow`}
                  className="inline-flex min-h-11 items-center rounded-xl border border-[color:var(--px-border-strong)] bg-[color:var(--px-surface)] px-3 text-sm font-black text-[color:var(--px-primary-ink)] hover:bg-[color:var(--px-muted)]">
                  View state →
                </Link>
              </div>
            </Card>
          ))}
          {deals.length === PAGE_LIMIT ? (
            <p className="text-sm text-[color:var(--px-text-muted)]">Showing the latest 30 records. Open All my Deals for older agreements.</p>
          ) : null}
        </div>
      ) : (
        <EmptyState title="No agreement records yet" body="You have no eligible Deal states to review. No real funds are collected or held by PtahX." />
      )}
    </AppSection>
  );
}
