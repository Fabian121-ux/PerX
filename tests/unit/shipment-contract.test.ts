import { describe, expect, it } from "vitest";

import { parseVerifiedShipment } from "@/lib/tracking/shipment-contract";

const updatedAt = new Date(Date.now() - 60_000).toISOString();

function payload(overrides: Record<string, unknown> = {}) {
  return {
    carrierName: "Verified carrier",
    dealId: "deal-123",
    trackingNumber: "CARRIER123456",
    status: "IN_TRANSIT",
    updatedAt,
    location: {
      verified: true,
      latitude: 6.5244,
      longitude: 3.3792,
      observedAt: updatedAt,
    },
    ...overrides,
  };
}

describe("trusted shipment gateway normalization", () => {
  it("accepts a matching booked shipment and location verified by the carrier", () => {
    const shipment = parseVerifiedShipment(payload(), "deal-123");
    expect(shipment?.carrierName).toBe("Verified carrier");
    expect(shipment?.trackingNumber).toBe("CARRIER123456");
    expect(shipment?.status).toBe("IN_TRANSIT");
    expect(shipment?.location?.source).toBe("verified-carrier");
    expect(shipment?.location?.latitude).toBe(6.5244);
  });

  it("rejects cross-deal responses, invalid statuses and malformed IDs", () => {
    expect(parseVerifiedShipment(payload(), "another-deal")).toBeNull();
    expect(parseVerifiedShipment(payload({ status: "ALREADY_PAID" }), "deal-123")).toBeNull();
    expect(parseVerifiedShipment(payload({ trackingNumber: "<script>alert(1)</script>" }), "deal-123")).toBeNull();
    expect(parseVerifiedShipment(payload({ updatedAt: "tomorrow" }), "deal-123")).toBeNull();
  });

  it("never plots unverified, stale-future, or invalid GPS coordinates", () => {
    const unverified = parseVerifiedShipment(payload({
      location: { latitude: 6.5, longitude: 3.4, verified: false, observedAt: updatedAt },
    }), "deal-123");
    expect(unverified?.location).toBeNull();
    const invalid = parseVerifiedShipment(payload({
      location: { latitude: 200, longitude: 3.4, verified: true, observedAt: updatedAt },
    }), "deal-123");
    expect(invalid?.location).toBeNull();
    const future = parseVerifiedShipment(payload({
      location: { latitude: 6.5, longitude: 3.4, verified: true, observedAt: "2099-01-01T00:00:00Z" },
    }), "deal-123");
    expect(future?.location).toBeNull();
  });

  it("does not infer delivery or shipment from an empty carrier response", () => {
    expect(parseVerifiedShipment(null, "deal-123")).toBeNull();
    expect(parseVerifiedShipment({ dealId: "deal-123", status: "IN_TRANSIT" }, "deal-123")).toBeNull();
  });
});
