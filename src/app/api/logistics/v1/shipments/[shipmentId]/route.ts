import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth/session";
import { getPrisma } from "@/lib/db/prisma";
import {
  GPS_MIN_INTERVAL_MS,
  logisticsV1Enabled,
  validGpsDuration,
  validGpsReport,
} from "@/lib/logistics/v1-policy";
import { readLogisticsV1Shipment, shipmentForViewer } from "@/lib/logistics/v1-server";

export const dynamic = "force-dynamic";

const inputSchema = z.object({
  action: z.enum([
    "accept", "start", "stop", "position", "picked_up",
    "in_transit", "delivered", "cancel",
  ]),
  minutes: z.number().int().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  accuracy: z.number().optional(),
}).strict();

function responseError(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(_request: Request, context: { params: Promise<{ shipmentId: string }> }) {
  if (!logisticsV1Enabled()) return responseError("Logistics pilot is not enabled.", 503);
  const user = await getCurrentUser();
  if (!user) return responseError("Sign in first.", 401);
  const { shipmentId } = await context.params;
  if (shipmentId.length > 140) return responseError("Not found.", 404);
  const data = await readLogisticsV1Shipment(shipmentId, user.id);
  if (!data) return responseError("Not found.", 404);
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request, context: { params: Promise<{ shipmentId: string }> }) {
  if (!logisticsV1Enabled()) return responseError("Logistics pilot is not enabled.", 503);
  const user = await getCurrentUser();
  if (!user) return responseError("Sign in first.", 401);
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return responseError("Request origin not allowed.", 403);
  }
  const { shipmentId } = await context.params;
  if (shipmentId.length > 140) return responseError("Not found.", 404);
  const body = inputSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return responseError("Invalid delivery update.", 400);
  const shipment = await shipmentForViewer(shipmentId, user.id);
  if (!shipment) return responseError("Not found.", 404);
  const driver = shipment.driverId === user.id;
  const buyer = shipment.buyerId === user.id;
  const seller = shipment.sellerId === user.id;
  const action = body.data.action;
  const db = getPrisma();
  const now = new Date();
  let changed = 0;

  if (action === "accept" && driver) {
    const update = await db.logisticsV1Shipment.updateMany({
      where: { id: shipment.id, driverId: user.id, status: "ASSIGNED", acceptedAt: null },
      data: { acceptedAt: now, status: "ACCEPTED" },
    });
    changed = update.count;
  } else if (action === "start" && driver && validGpsDuration(body.data.minutes)) {
    const until = new Date(now.getTime() + body.data.minutes * 60_000);
    const update = await db.logisticsV1Shipment.updateMany({
      where: {
        id: shipment.id, driverId: user.id,
        acceptedAt: { not: null }, status: { in: ["ACCEPTED", "PICKED_UP", "IN_TRANSIT"] },
      },
      data: {
        sharingStartedAt: now, sharingUntil: until,
        lastLatitude: null, lastLongitude: null, lastAccuracyMetres: null,
        lastLocationAt: null, lastPositionWriteAt: null,
      },
    });
    changed = update.count;
  } else if (action === "stop" && driver) {
    const update = await db.logisticsV1Shipment.updateMany({
      where: { id: shipment.id, driverId: user.id },
      data: {
        sharingUntil: null, sharingStartedAt: null,
        lastLatitude: null, lastLongitude: null, lastAccuracyMetres: null,
        lastLocationAt: null, lastPositionWriteAt: null,
      },
    });
    changed = update.count;
  } else if (action === "position" && driver && validGpsReport(body.data)) {
    const update = await db.logisticsV1Shipment.updateMany({
      where: {
        id: shipment.id, driverId: user.id,
        acceptedAt: { not: null }, sharingUntil: { gt: now },
        status: { in: ["ACCEPTED", "PICKED_UP", "IN_TRANSIT"] },
        OR: [
          { lastPositionWriteAt: null },
          { lastPositionWriteAt: { lte: new Date(now.getTime() - GPS_MIN_INTERVAL_MS) } },
        ],
      },
      data: {
        lastLatitude: Number(body.data.latitude!.toFixed(4)),
        lastLongitude: Number(body.data.longitude!.toFixed(4)),
        lastAccuracyMetres: Math.round(body.data.accuracy!),
        lastLocationAt: now,
        lastPositionWriteAt: now,
      },
    });
    changed = update.count;
  } else if (action === "picked_up" && driver) {
    changed = (await db.logisticsV1Shipment.updateMany({
      where: { id: shipment.id, driverId: user.id, acceptedAt: { not: null }, status: "ACCEPTED" },
      data: { status: "PICKED_UP" },
    })).count;
  } else if (action === "in_transit" && driver) {
    changed = (await db.logisticsV1Shipment.updateMany({
      where: { id: shipment.id, driverId: user.id, status: "PICKED_UP" },
      data: { status: "IN_TRANSIT" },
    })).count;
  } else if (action === "delivered" && buyer) {
    changed = (await db.logisticsV1Shipment.updateMany({
      where: { id: shipment.id, buyerId: user.id, status: { in: ["PICKED_UP", "IN_TRANSIT"] } },
      data: {
        status: "DELIVERED", sharingUntil: null, sharingStartedAt: null,
        lastLatitude: null, lastLongitude: null, lastAccuracyMetres: null,
        lastLocationAt: null, lastPositionWriteAt: null,
      },
    })).count;
  } else if (action === "cancel" && seller) {
    changed = (await db.logisticsV1Shipment.updateMany({
      where: { id: shipment.id, sellerId: user.id, status: { in: ["ASSIGNED", "ACCEPTED"] } },
      data: {
        status: "CANCELLED", sharingUntil: null, sharingStartedAt: null,
        lastLatitude: null, lastLongitude: null, lastAccuracyMetres: null,
        lastLocationAt: null, lastPositionWriteAt: null,
      },
    })).count;
  }
  if (!changed) return responseError("Not permitted, sharing expired, or update too frequent. Check the current delivery status.", 409);
  const result = await readLogisticsV1Shipment(shipment.id, user.id);
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
