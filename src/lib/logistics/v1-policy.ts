/** Shared pure constraints. No background permission or hotspot-based location. */
export const GPS_MIN_INTERVAL_MS = 25_000;
export const GPS_MAX_ACCURACY_METRES = 300;
export const GPS_STALE_AFTER_MS = 120_000;
export const GPS_DURATIONS_MINUTES = [15, 30, 60, 120] as const;
export const LOGISTICS_V1_POLL_MS = 30_000;
/** Hard pilot cap to protect the free database until measured load testing. */
export const LOGISTICS_V1_MAX_ACTIVE_ASSIGNMENTS = 20;

export function logisticsV1Enabled() {
  return process.env.PTAHX_LOGISTICS_V1_ENABLED === "1";
}

export function validGpsDuration(value: unknown): value is 15 | 30 | 60 | 120 {
  return GPS_DURATIONS_MINUTES.includes(value as 15 | 30 | 60 | 120);
}

export function validGpsReport(input: unknown): input is {
  latitude: number;
  longitude: number;
  accuracy: number;
} {
  if (!input || typeof input !== "object") return false;
  const v = input as Record<string, unknown>;
  return (
    typeof v.latitude === "number" && Number.isFinite(v.latitude) &&
    typeof v.longitude === "number" && Number.isFinite(v.longitude) &&
    typeof v.accuracy === "number" && Number.isFinite(v.accuracy) &&
    v.latitude >= -90 && v.latitude <= 90 &&
    v.longitude >= -180 && v.longitude <= 180 &&
    v.accuracy > 0 && v.accuracy <= GPS_MAX_ACCURACY_METRES
  );
}

export function canShareLocation(input: {
  status: string;
  acceptedAt: Date | null;
  sharingUntil: Date | null;
}, now = new Date()) {
  return Boolean(
    input.acceptedAt &&
    ["ACCEPTED", "PICKED_UP", "IN_TRANSIT"].includes(input.status) &&
    input.sharingUntil && input.sharingUntil.getTime() > now.getTime(),
  );
}

export function publicDriverLocation(input: {
  status: string;
  acceptedAt: Date | null;
  sharingUntil: Date | null;
  lastLocationAt: Date | null;
  lastLatitude: number | null;
  lastLongitude: number | null;
  lastAccuracyMetres: number | null;
}, now = new Date()) {
  if (!canShareLocation(input, now) || !input.lastLocationAt ||
    now.getTime() - input.lastLocationAt.getTime() > GPS_STALE_AFTER_MS ||
    !Number.isFinite(input.lastLatitude) || !Number.isFinite(input.lastLongitude)) {
    return null;
  }
  return {
    latitude: Number(input.lastLatitude!.toFixed(3)),
    longitude: Number(input.lastLongitude!.toFixed(3)),
    accuracyMetres: input.lastAccuracyMetres,
    observedAt: input.lastLocationAt.toISOString(),
  };
}
