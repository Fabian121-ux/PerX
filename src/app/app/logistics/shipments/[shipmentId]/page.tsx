import { notFound } from "next/navigation";
import { AppSection } from "@/components/app-section";
import { LogisticsV1Workspace } from "@/components/logistics/v1-workspace";
import { requireUser } from "@/lib/auth/session";
import { logisticsV1Enabled } from "@/lib/logistics/v1-policy";
import { readLogisticsV1Shipment } from "@/lib/logistics/v1-server";

export default async function LogisticsV1ShipmentPage({
  params,
}: {
  params: Promise<{ shipmentId: string }>;
}) {
  if (!logisticsV1Enabled()) notFound();
  const user = await requireUser();
  const { shipmentId } = await params;
  if (!shipmentId || shipmentId.length > 140) notFound();
  const snapshot = await readLogisticsV1Shipment(shipmentId, user.id);
  if (!snapshot) notFound();
  return (
    <AppSection
      title="Track your delivery"
      description="Live GPS is available only when the assigned driver accepts and chooses to share their location for a limited time."
    >
      <LogisticsV1Workspace initial={snapshot} />
    </AppSection>
  );
}
