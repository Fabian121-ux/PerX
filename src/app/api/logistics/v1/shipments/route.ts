import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth/session";
import { getPrisma } from "@/lib/db/prisma";
import { logisticsV1Enabled } from "@/lib/logistics/v1-policy";

export const dynamic = "force-dynamic";

const dispatchSchema = z.object({
  dealId: z.string().min(1).max(140),
  driverUsername: z.string().min(2).max(48).regex(/^[a-zA-Z0-9_.-]+$/),
}).strict();

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
}

/** Seller initiates one dispatch from an EXISTING accepted PRODUCT Deal. */
export async function POST(request: Request) {
  if (!logisticsV1Enabled()) return jsonError("Logistics pilot is not enabled.", 503);
  const user = await getCurrentUser();
  if (!user) return jsonError("Sign in to arrange a delivery.", 401);
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return jsonError("Request origin not allowed.", 403);
  }
  const body = dispatchSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return jsonError("Enter a valid deal and driver username.", 400);
  const db = getPrisma();
  const deal = await db.deal.findFirst({
    where: {
      id: body.data.dealId,
      participants: { some: { userId: user.id } },
      proposal: { opportunity: { ownerId: user.id, type: "PRODUCT" } },
    },
    select: {
      id: true,
      proposal: { select: { senderId: true } },
      participants: { select: { userId: true } },
    },
  });
  if (!deal || !deal.participants.some((p) => p.userId === deal.proposal.senderId)) {
    return jsonError("You cannot dispatch this product agreement.", 404);
  }
  const driver = await db.user.findUnique({
    where: { username: body.data.driverUsername },
    select: { id: true, isActive: true, bannedAt: true, suspendedUntil: true },
  });
  if (!driver || !driver.isActive || driver.bannedAt ||
    (driver.suspendedUntil && driver.suspendedUntil > new Date()) ||
    driver.id === user.id || driver.id === deal.proposal.senderId) {
    return jsonError("Choose a different active PtahX member as the driver.", 400);
  }
  try {
    const shipment = await db.logisticsV1Shipment.create({
      data: {
        dealId: deal.id,
        sellerId: user.id,
        buyerId: deal.proposal.senderId,
        driverId: driver.id,
      },
      select: { id: true },
    });
    return NextResponse.json({ id: shipment.id, href: `/app/logistics/shipments/${shipment.id}` }, {
      status: 201, headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    // Unique deal key also protects concurrent duplicate dispatch requests.
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      return jsonError("This deal already has a delivery. Open Tracking Centre.", 409);
    }
    throw error;
  }
}
