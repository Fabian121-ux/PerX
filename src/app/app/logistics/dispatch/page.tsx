import Link from "next/link";
import { notFound } from "next/navigation";

import { AppSection } from "@/components/app-section";
import { LogisticsV1DispatchForm } from "@/components/logistics/v1-dispatch-form";
import { Card } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";
import { getPrisma } from "@/lib/db/prisma";
import { logisticsV1Enabled } from "@/lib/logistics/v1-policy";

export default async function LogisticsDispatchPage({
  searchParams,
}: {
  searchParams: Promise<{ deal?: string }>;
}) {
  if (!logisticsV1Enabled()) notFound();
  const user = await requireUser();
  const { deal: dealId } = await searchParams;
  if (!dealId || dealId.length > 140) notFound();
  const db = getPrisma();
  const deal = await db.deal.findFirst({
    where: {
      id: dealId,
      participants: { some: { userId: user.id } },
      proposal: { opportunity: { ownerId: user.id, type: "PRODUCT" } },
    },
    select: {
      id: true,
      proposal: { select: { opportunity: { select: { title: true } } } },
    },
  });
  if (!deal) notFound();
  const existing = await db.logisticsV1Shipment.findUnique({
    where: { dealId: deal.id }, select: { id: true },
  });
  return (
    <AppSection title="Arrange a delivery" description={`Product agreement: ${deal.proposal.opportunity.title}`}>
      {existing ? (
        <Card>
          <p className="font-bold text-[color:var(--px-text)]">This product already has a delivery assignment.</p>
          <Link href={`/app/logistics/shipments/${existing.id}`} className="mt-3 inline-flex min-h-11 items-center font-black text-[color:var(--px-primary)]">
            Open delivery tracking →
          </Link>
        </Card>
      ) : <LogisticsV1DispatchForm dealId={deal.id} />}
    </AppSection>
  );
}
