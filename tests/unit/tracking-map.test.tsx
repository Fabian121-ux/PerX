// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  getTrackingMapExternalUrl,
  getTrackingMapUrl,
  isVerifiedCarrierLocation,
  type VerifiedCarrierLocation,
} from "@/lib/tracking/map";
import { TrackingMapPanel } from "@/components/tracking/tracking-map-panel";

afterEach(cleanup);

const reported: VerifiedCarrierLocation = {
  source: "verified-carrier",
  latitude: 6.5244,
  longitude: 3.3792,
  carrierName: "Test carrier",
  observedAt: "2026-10-19T08:00:00Z",
};

describe("real map without fake parcel location", () => {
  it("shows a general Nigeria map without any parcel marker", () => {
    const url = new URL(getTrackingMapUrl());
    expect(url.origin).toBe("https://www.openstreetmap.org");
    expect(url.pathname).toBe("/export/embed.html");
    expect(url.searchParams.get("layer")).toBe("mapnik");
    expect(url.searchParams.has("marker")).toBe(false);
    expect(getTrackingMapExternalUrl()).not.toContain("mlat");
  });

  it("only places a marker from an explicit verified carrier event", () => {
    expect(isVerifiedCarrierLocation(reported)).toBe(true);
    const url = new URL(getTrackingMapUrl(reported));
    expect(url.searchParams.get("marker")).toBe("6.524,3.379");
    expect(isVerifiedCarrierLocation({ ...reported, source: "manual" } as never)).toBe(false);
    expect(getTrackingMapUrl({ ...reported, source: "manual" } as never)).not.toContain("marker=");
    expect(isVerifiedCarrierLocation({ ...reported, latitude: Number.NaN })).toBe(false);
    expect(isVerifiedCarrierLocation({ ...reported, longitude: 300 })).toBe(false);
    expect(isVerifiedCarrierLocation({ ...reported, observedAt: "not-date" })).toBe(false);
  });

  it("loads the interactive map only when someone taps Open, and clearly labels it", () => {
    render(<TrackingMapPanel />);
    expect(screen.getByText("Location not available")).toBeTruthy();
    expect(screen.queryByTitle("General map of Nigeria — not your parcel location")).toBeNull();
    const open = screen.getByRole("button", { name: "Open interactive map" });
    fireEvent.click(open);
    const iframe = screen.getByTitle("General map of Nigeria — not your parcel location") as HTMLIFrameElement;
    expect(iframe.getAttribute("src")).toContain("openstreetmap.org/export/embed.html");
    expect(iframe.getAttribute("loading")).toBe("lazy");
    expect(screen.getByText(/This is a general map, not a live delivery tracker/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Hide map" }));
    expect(screen.queryByTitle("General map of Nigeria — not your parcel location")).toBeNull();
  });

  it("accepts an actual verified courier area without claiming it is live", () => {
    render(<TrackingMapPanel location={reported} />);
    expect(screen.getByText("Verified courier location available")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Open interactive map" }));
    expect(screen.getByTitle("Approximate verified courier area")).toBeTruthy();
    expect(screen.getByText(/Carrier: Test carrier/)).toBeTruthy();
  });
});
