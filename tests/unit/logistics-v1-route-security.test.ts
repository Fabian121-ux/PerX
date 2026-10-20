import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getPrisma: vi.fn(),
  shipmentForViewer: vi.fn(),
  readLogisticsV1Shipment: vi.fn(),
  updateMany: vi.fn(),
  count: vi.fn(),
  create: vi.fn(),
  deal: vi.fn(),
  findDriver: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/lib/db/prisma", () => ({ getPrisma: mocks.getPrisma }));
vi.mock("@/lib/logistics/v1-server", () => ({
  shipmentForViewer: mocks.shipmentForViewer,
  readLogisticsV1Shipment: mocks.readLogisticsV1Shipment,
}));

import { POST as dispatch } from "@/app/api/logistics/v1/shipments/route";
import {
  GET as getShipment,
  POST as updateShipment,
} from "@/app/api/logistics/v1/shipments/[shipmentId]/route";

const URL = "https://ptahx.com/api/logistics/v1/shipments/s-1";
const routeContext = { params: Promise.resolve({ shipmentId: "s-1" }) };
function post(url: string, data: Record<string, unknown>, origin = "https://ptahx.com") {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: origin },
    body: JSON.stringify(data),
  });
}
function assignment(overrides: Record<string, unknown> = {}) {
  return {
    id: "s-1",
    buyerId: "buyer",
    sellerId: "seller",
    driverId: "driver",
    acceptedAt: new Date(Date.now() - 60_000),
    status: "IN_TRANSIT",
    sharingUntil: new Date(Date.now() + 60_000),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("PTAHX_LOGISTICS_V1_ENABLED", "1");
  mocks.getCurrentUser.mockResolvedValue({ id: "driver" });
  mocks.shipmentForViewer.mockResolvedValue(assignment());
  mocks.readLogisticsV1Shipment.mockResolvedValue({ id: "s-1", status: "IN_TRANSIT", role: "driver", location: null });
  mocks.updateMany.mockResolvedValue({ count: 1 });
  mocks.count.mockResolvedValue(0);
  mocks.create.mockResolvedValue({ id: "s-1" });
  mocks.deal.mockResolvedValue({
    id: "deal-1",
    proposal: { senderId: "buyer" },
    participants: [{ userId: "buyer" }, { userId: "seller" }],
  });
  mocks.findDriver.mockResolvedValue({
    id: "driver", isActive: true, bannedAt: null, suspendedUntil: null,
  });
  mocks.getPrisma.mockReturnValue({
    logisticsV1Shipment: {
      updateMany: mocks.updateMany,
      count: mocks.count,
      create: mocks.create,
    },
    deal: { findFirst: mocks.deal },
    user: { findUnique: mocks.findDriver },
  });
});

afterEach(() => vi.unstubAllEnvs());

describe("logistics V1 API security and rate limiting", () => {
  it("is feature-gated and fails closed when no schema has been enabled", async () => {
    vi.stubEnv("PTAHX_LOGISTICS_V1_ENABLED", "0");
    const res = await getShipment(new Request(URL), routeContext);
    expect(res.status).toBe(503);
    expect(mocks.shipmentForViewer).not.toHaveBeenCalled();
  });

  it("does not expose a shipment to a nonparticipant", async () => {
    mocks.shipmentForViewer.mockResolvedValue(null);
    const res = await updateShipment(post(URL, { action: "start", minutes: 15 }), routeContext);
    expect(res.status).toBe(404);
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });

  it("prevents the buyer from starting or impersonating a driver location", async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: "buyer" });
    const start = await updateShipment(post(URL, { action: "start", minutes: 60 }), routeContext);
    const gps = await updateShipment(post(URL, {
      action: "position", latitude: 6.52, longitude: 3.38, accuracy: 20,
    }), routeContext);
    expect(start.status).toBe(409);
    expect(gps.status).toBe(409);
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });

  it("rejects cross-origin requests and invalid GPS coordinates", async () => {
    const cross = await updateShipment(post(URL, { action: "stop" }, "https://another-site.example"), routeContext);
    const invalid = await updateShipment(post(URL, {
      action: "position", latitude: 300, longitude: 3.38, accuracy: 20,
    }), routeContext);
    expect(cross.status).toBe(403);
    expect(invalid.status).toBe(409);
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });

  it("enforces atomic server throttling and a sharing deadline", async () => {
    const res = await updateShipment(post(URL, {
      action: "position", latitude: 6.52, longitude: 3.38, accuracy: 25,
    }), routeContext);
    expect(res.status).toBe(200);
    const where = mocks.updateMany.mock.calls[0][0].where;
    expect(where.driverId).toBe("driver");
    expect(where.sharingUntil.gt).toBeInstanceOf(Date);
    expect(where.lastPositionWriteAt).toBeUndefined();
    expect(where.OR).toHaveLength(2);
    expect(where.status.in).toEqual(["ACCEPTED", "PICKED_UP", "IN_TRANSIT"]);
  });

  it("seller dispatches only an accepted product Deal to an active registered driver", async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: "seller" });
    const response = await dispatch(post("https://ptahx.com/api/logistics/v1/shipments", {
      dealId: "deal-1", driverUsername: "driver01",
    }));
    expect(response.status).toBe(201);
    expect(mocks.deal.mock.calls[0][0].where.proposal.opportunity).toEqual({
      ownerId: "seller", type: "PRODUCT",
    });
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        dealId: "deal-1", sellerId: "seller", buyerId: "buyer", driverId: "driver",
      }),
    }));
  });

  it("caps concurrent free-tier test deliveries", async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: "seller" });
    mocks.count.mockResolvedValue(20);
    const response = await dispatch(post("https://ptahx.com/api/logistics/v1/shipments", {
      dealId: "deal-1", driverUsername: "driver01",
    }));
    expect(response.status).toBe(429);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("delivery confirmation immediately revokes and deletes stored GPS", async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: "buyer" });
    const res = await updateShipment(post(URL, { action: "delivered" }), routeContext);
    expect(res.status).toBe(200);
    const update = mocks.updateMany.mock.calls[0][0];
    expect(update.data).toMatchObject({
      status: "DELIVERED", sharingUntil: null,
      lastLatitude: null, lastLongitude: null, lastLocationAt: null,
    });
  });
});
