/**
 * Map display rules. Never derive a parcel marker from a listing address,
 * buyer profile, deal state or browser location. Only signed/verified courier
 * events from a future shipment integration may supply a marker.
 */
export type VerifiedCarrierLocation = {
  source: "verified-carrier";
  latitude: number;
  longitude: number;
  observedAt: string;
  carrierName: string;
};

const NIGERIA_CENTRE = { latitude: 9.082, longitude: 8.6753 };
const OSM_BASE = "https://www.openstreetmap.org";

export function isVerifiedCarrierLocation(
  input: VerifiedCarrierLocation | null | undefined,
): input is VerifiedCarrierLocation {
  return Boolean(
    input &&
    input.source === "verified-carrier" &&
    Number.isFinite(input.latitude) &&
    Number.isFinite(input.longitude) &&
    input.latitude >= -90 &&
    input.latitude <= 90 &&
    input.longitude >= -180 &&
    input.longitude <= 180 &&
    input.carrierName.trim().length > 0 &&
    Number.isFinite(Date.parse(input.observedAt)),
  );
}

function centreFor(input: VerifiedCarrierLocation | null | undefined) {
  if (!isVerifiedCarrierLocation(input)) return NIGERIA_CENTRE;
  // The map shares only approximate locations with a third-party provider,
  // not someone's house or a raw high-precision courier coordinate.
  return {
    latitude: Number(input.latitude.toFixed(3)),
    longitude: Number(input.longitude.toFixed(3)),
  };
}

export function getTrackingMapUrl(
  location?: VerifiedCarrierLocation | null,
): string {
  const isShipmentLocation = isVerifiedCarrierLocation(location);
  const { latitude, longitude } = centreFor(location);
  const latDelta = isShipmentLocation ? 0.04 : 5.2;
  const lonDelta = isShipmentLocation ? 0.06 : 5.8;
  const bounds = [
    Math.max(-180, longitude - lonDelta),
    Math.max(-90, latitude - latDelta),
    Math.min(180, longitude + lonDelta),
    Math.min(90, latitude + latDelta),
  ];
  const url = new URL("/export/embed.html", OSM_BASE);
  url.searchParams.set("bbox", bounds.join(","));
  url.searchParams.set("layer", "mapnik");
  if (isShipmentLocation) {
    url.searchParams.set("marker", `${latitude},${longitude}`);
  }
  return url.toString();
}

export function getTrackingMapExternalUrl(
  location?: VerifiedCarrierLocation | null,
): string {
  const centre = centreFor(location);
  const url = new URL("/", OSM_BASE);
  url.searchParams.set("mlat", String(centre.latitude));
  url.searchParams.set("mlon", String(centre.longitude));
  url.hash = `map=${isVerifiedCarrierLocation(location) ? "13" : "6"}/${centre.latitude}/${centre.longitude}`;
  // No parcel marker should ever be added without a verified carrier location.
  if (!isVerifiedCarrierLocation(location)) {
    url.searchParams.delete("mlat");
    url.searchParams.delete("mlon");
  }
  return url.toString();
}
