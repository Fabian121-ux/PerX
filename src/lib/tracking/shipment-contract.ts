import {
  isVerifiedCarrierLocation,
  type VerifiedCarrierLocation,
} from "@/lib/tracking/map";

/** A normalized shipment returned only by our authenticated carrier gateway. */
export type VerifiedShipment = {
  dealId: string;
  carrierName: string;
  trackingNumber: string;
  status: "LABEL_CREATED" | "PICKED_UP" | "IN_TRANSIT" | "OUT_FOR_DELIVERY" | "DELIVERED" | "EXCEPTION";
  updatedAt: string;
  location: VerifiedCarrierLocation | null;
};

export type ShipmentGatewayPayload = {
  dealId?: unknown;
  carrierName?: unknown;
  trackingNumber?: unknown;
  status?: unknown;
  updatedAt?: unknown;
  location?: {
    latitude?: unknown;
    longitude?: unknown;
    observedAt?: unknown;
    verified?: unknown;
  } | null;
};

const allowedStatuses = new Set<VerifiedShipment["status"]>([
  "LABEL_CREATED",
  "PICKED_UP",
  "IN_TRANSIT",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "EXCEPTION",
]);

const MAX_RESPONSE_BYTES = 16_384;
const REQUEST_TIMEOUT_MS = 3_500;

function safeString(value: unknown, maxLength: number) {
  return typeof value === "string" &&
    value.length > 0 &&
    value.length <= maxLength &&
    !/[<>\r\n]/.test(value)
    ? value
    : null;
}

function validTimestamp(value: unknown) {
  if (typeof value !== "string" || value.length > 40) return false;
  const timestamp = Date.parse(value);
  // A carrier timestamp can be older than today, never significantly future.
  return Number.isFinite(timestamp) &&
    timestamp >= Date.UTC(2020, 0, 1) &&
    timestamp <= Date.now() + 300_000;
}

export function parseVerifiedShipment(
  payload: unknown,
  expectedDealId: string,
): VerifiedShipment | null {
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) return null;
  const input = payload as ShipmentGatewayPayload;

  if (input.dealId !== expectedDealId) return null;
  const carrierName = safeString(input.carrierName, 100);
  const trackingNumber = safeString(input.trackingNumber, 100);
  if (!carrierName || !trackingNumber || !validTimestamp(input.updatedAt)) return null;
  if (!allowedStatuses.has(input.status as VerifiedShipment["status"])) return null;

  let location: VerifiedCarrierLocation | null = null;
  const geo = input.location;
  if (geo && typeof geo === "object" && geo.verified === true) {
    const coordinate = {
      source: "verified-carrier" as const,
      carrierName,
      latitude: geo.latitude,
      longitude: geo.longitude,
      observedAt: geo.observedAt,
    };
    if (isVerifiedCarrierLocation(coordinate as VerifiedCarrierLocation) &&
      validTimestamp(geo.observedAt) &&
      Date.parse(geo.observedAt as string) <= Date.parse(input.updatedAt as string) + 300_000) {
      location = coordinate as VerifiedCarrierLocation;
    }
  }

  return {
    dealId: expectedDealId,
    carrierName,
    trackingNumber,
    status: input.status as VerifiedShipment["status"],
    updatedAt: input.updatedAt as string,
    location,
  };
}

