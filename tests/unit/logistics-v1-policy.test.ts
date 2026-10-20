import { describe, expect, it } from "vitest";
import {
  canShareLocation, publicDriverLocation, validGpsDuration, validGpsReport,
  GPS_MIN_INTERVAL_MS, LOGISTICS_V1_POLL_MS, LOGISTICS_V1_MAX_ACTIVE_ASSIGNMENTS,
} from "@/lib/logistics/v1-policy";

const now = new Date("2026-10-19T19:00:00.000Z");
const active = {
  acceptedAt: new Date(now.getTime() - 60_000),
  status: "IN_TRANSIT",
  sharingUntil: new Date(now.getTime() + 60_000),
  lastLocationAt: new Date(now.getTime() - 20_000),
  lastLatitude: 6.52441,
  lastLongitude: 3.37921,
  lastAccuracyMetres: 15,
};

describe("PtahX Logistics V1 privacy and free-tier controls", () => {
  it("requires genuine consent and limits the sharing duration", () => {
    expect(validGpsDuration(15)).toBe(true);
    expect(validGpsDuration(120)).toBe(true);
    expect(validGpsDuration(180)).toBe(false);
    expect(validGpsDuration("60")).toBe(false);
    expect(canShareLocation(active, now)).toBe(true);
    expect(canShareLocation({ ...active, sharingUntil: now }, now)).toBe(false);
    expect(canShareLocation({ ...active, acceptedAt: null }, now)).toBe(false);
    expect(canShareLocation({ ...active, status: "DELIVERED" }, now)).toBe(false);
    expect(canShareLocation({ ...active, status: "ASSIGNED" }, now)).toBe(false);
  });

  it("only returns current approximate coordinates when sharing is active", () => {
    expect(publicDriverLocation(active, now)).toEqual({
      latitude: 6.524, longitude: 3.379, accuracyMetres: 15,
      observedAt: "2026-10-19T18:59:40.000Z",
    });
    expect(publicDriverLocation({ ...active, lastLocationAt: new Date(now.getTime() - 180_000) }, now)).toBeNull();
    expect(publicDriverLocation({ ...active, lastLongitude: null }, now)).toBeNull();
    expect(publicDriverLocation({ ...active, sharingUntil: null }, now)).toBeNull();
  });

  it("rejects inaccurate and malformed location reports", () => {
    expect(validGpsReport({ latitude: 6.5244, longitude: 3.3792, accuracy: 30 })).toBe(true);
    expect(validGpsReport({ latitude: 6.5244, longitude: 3.3792, accuracy: 1200 })).toBe(false);
    expect(validGpsReport({ latitude: 91, longitude: 3.3792, accuracy: 10 })).toBe(false);
    expect(validGpsReport({ latitude: Number.NaN, longitude: 3.3792, accuracy: 10 })).toBe(false);
    expect(validGpsReport({ latitude: 6.5, longitude: 3, accuracy: 0 })).toBe(false);
  });

  it("does not create high-frequency writes by default", () => {
    expect(GPS_MIN_INTERVAL_MS).toBeGreaterThanOrEqual(25_000);
    expect(LOGISTICS_V1_POLL_MS).toBeGreaterThanOrEqual(30_000);
    expect(LOGISTICS_V1_MAX_ACTIVE_ASSIGNMENTS).toBeLessThanOrEqual(20);
  });
});
