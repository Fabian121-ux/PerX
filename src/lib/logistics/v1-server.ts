import "server-only";

import { getPrisma } from "@/lib/db/prisma";
import { canShareLocation, publicDriverLocation } from "@/lib/logistics/v1-policy";

export type LogisticsV1Snapshot = {
  id: string;
  dealId: string;
  role: "seller" | "buyer" | "driver";
  status: string;
  driverName: string;
  driverAccepted: boolean;
  sharing: boolean;
  sharingUntil: string | null;
  location: {
    latitude: number;
    longitude: number;
    accuracyMetres: number | null;
    observedAt: string;
  } | null;
  updatedAt: string;
};

export async function shipmentForViewer(shipmentId: string, viewerId: string) {
  return getPrisma().logisticsV1Shipment.findFirst({
    where: {
      id: shipmentId,
      OR: [{ sellerId: viewerId }, { buyerId: viewerId }, { driverId: viewerId }],
    },
    select: {
      id: true,
      dealId: true,
      sellerId: true,
      buyerId: true,
      driverId: true,
      status: true,
      acceptedAt: true,
      sharingUntil: true,
      lastLatitude: true,
      lastLongitude: true,
      lastAccuracyMetres: true,
      lastLocationAt: true,
      updatedAt: true,
      driver: { select: { name: true } },
    },
  });
}

export type VisibleShipment = NonNullable<Awaited<ReturnType<typeof shipmentForViewer>>>;

export function toLogisticsV1Snapshot(shipment: VisibleShipment, viewerId: string): LogisticsV1Snapshot {
  const role: LogisticsV1Snapshot["role"] = shipment.driverId === viewerId
    ? "driver" : shipment.sellerId === viewerId ? "seller" : "buyer";
  const sharing = canShareLocation(shipment);
  const location = publicDriverLocation(shipment);
  return {
    id: shipment.id,
    dealId: shipment.dealId,
    role,
    status: shipment.status,
    driverName: shipment.driver.name,
    driverAccepted: Boolean(shipment.acceptedAt),
    sharing,
    sharingUntil: sharing ? shipment.sharingUntil!.toISOString() : null,
    location,
    updatedAt: shipment.updatedAt.toISOString(),
  };
}

/** No location returned after session expiry, even if a driver loses network. */
export async function readLogisticsV1Shipment(id: string, userId: string) {
  const row = await shipmentForViewer(id, userId);
  if (!row) return null;
  // Opportunistic one-row cleanup avoids requiring paid cron services.
  if (row.sharingUntil && row.sharingUntil <= new Date()) {
    await getPrisma().logisticsV1Shipment.updateMany({
      where: { id: row.id, sharingUntil: { lte: new Date() } },
      data: {
        sharingUntil: null,
        sharingStartedAt: null,
        lastLatitude: null,
        lastLongitude: null,
        lastAccuracyMetres: null,
        lastLocationAt: null,
        lastPositionWriteAt: null,
      },
    });
    const cleaned = await shipmentForViewer(id, userId);
    return cleaned ? toLogisticsV1Snapshot(cleaned, userId) : null;
  }
  return toLogisticsV1Snapshot(row, userId);
}
