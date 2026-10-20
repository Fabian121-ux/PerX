import Link from "next/link";
import { notFound } from "next/navigation";

import { AppSection } from "@/components/app-section";
import { Card, EmptyState } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";
import { getPrisma } from "@/lib/db/prisma";
import { logisticsV1Enabled } from "@/lib/logistics/v1-policy";

export default async function LogisticsV1DriverDashboard() {
  if (!logisticsV1Enabled()) notFound();
  const user = await requireUser();
  const shipments = await getPrisma().logisticsV1Shipment.findMany({
    where: { driverId: user.id },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 20,
    select: {
      id: true,
      status: true,
      acceptedAt: true,
      deal: { select: {
        proposal: { select: { opportunity: { select: { title: true } } } },
      } },
    },
  });
  return (
    <AppSection title="Driver dashboard" description="Accept a delivery and choose when to share your own phone's GPS. No background GPS runs from this website.">
      {shipments.length ? (
        <div className="grid gap-3">
          {shipments.map((row) => (
            <Link key={row.id} href={`/app/logistics/shipments/${row.id}`} className="block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)]">
              <Card className="transition hover:border-[color:var(--px-primary)]">
                <p className="text-xs font-black uppercase text-[color:var(--px-primary)]">
                  {row.status.replaceAll("_", " ").toLowerCase()}
                </p>
                <h2 className="mt-2 font-black text-[color:var(--px-text)]">{row.deal.proposal.opportunity.title}</h2>
                <p className="mt-2 text-sm text-[color:var(--px-text-muted)]">
                  {row.acceptedAt ? "Open GPS and delivery controls →" : "Open to accept this delivery →"}
                </p>
              </Card>
            </Link>
          ))}
        </div>
      ) : <EmptyState title="No driver assignments yet" body="Ask a seller to assign your PtahX username to an existing product agreement. You must accept before GPS can start." />}
    </AppSection>
  );
}
