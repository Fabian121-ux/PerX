"use client";

import { ArrowUpRight, MapPin, MapPinOff, ShieldCheck, X } from "lucide-react";
import { useState } from "react";

import {
  getTrackingMapExternalUrl,
  getTrackingMapUrl,
  isVerifiedCarrierLocation,
  type VerifiedCarrierLocation,
} from "@/lib/tracking/map";

/**
 * Click-to-load real, interactive OpenStreetMap. The map itself is genuinely
 * pannable/zoomable. A parcel marker is intentionally absent until the server
 * has an actual verified carrier event; a plain agreement is not a shipment.
 *
 * External maps are never loaded on initial page render (faster and private).
 */
export function TrackingMapPanel({
  location = null,
}: {
  location?: VerifiedCarrierLocation | null;
}) {
  const [open, setOpen] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const hasLocation = isVerifiedCarrierLocation(location);

  return (
    <section
      aria-label="Interactive tracking map"
      className="overflow-hidden rounded-[22px] border border-[color:var(--px-border)] bg-[color:var(--px-surface)] shadow-[var(--px-shadow)]"
    >
      <div className="flex items-start justify-between gap-3 p-4 sm:p-5">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[color:var(--px-primary-soft)] text-[color:var(--px-primary)]">
            <MapPin aria-hidden size={21} />
          </span>
          <div>
            <h2 className="text-base font-black text-[color:var(--px-text)]">Interactive map</h2>
            <p className="mt-1 text-xs leading-5 text-[color:var(--px-text-muted)]">
              {hasLocation
                ? "Last confirmed area from the delivery partner."
                : "Explore the map. No parcel location has been confirmed."}
            </p>
          </div>
        </div>
        {open ? (
          <button
            aria-label="Close interactive map"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-[color:var(--px-border)] text-[color:var(--px-text)] hover:bg-[color:var(--px-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)]"
            onClick={() => setOpen(false)}
            type="button"
          >
            <X aria-hidden size={18} />
          </button>
        ) : null}
      </div>

      {open ? (
        <div className="relative h-[290px] w-full border-y border-[color:var(--px-border)] bg-[color:var(--px-muted)] sm:h-[360px]">
          {loadFailed ? (
            <div role="alert" className="grid h-full place-items-center p-5 text-center text-sm font-semibold text-[color:var(--px-text)]">
              Map could not load. Please check your network or open OpenStreetMap below.
            </div>
          ) : (
            <iframe
              className="h-full w-full border-0"
              loading="lazy"
              onError={() => setLoadFailed(true)}
              referrerPolicy="strict-origin-when-cross-origin"
              src={getTrackingMapUrl(location)}
              title={hasLocation ? "Approximate verified courier area" : "General map of Nigeria — not your parcel location"}
            />
          )}
        </div>
      ) : (
        <div className="mx-4 mb-4 grid min-h-48 place-items-center rounded-2xl border border-dashed border-[color:var(--px-border-strong)] bg-[color:var(--px-surface-soft)] p-5 text-center sm:mx-5 sm:mb-5">
          <div className="max-w-xs">
            {hasLocation ? (
              <ShieldCheck aria-hidden className="mx-auto text-[color:var(--px-primary)]" size={32} />
            ) : (
              <MapPinOff aria-hidden className="mx-auto text-[color:var(--px-text-muted)]" size={32} />
            )}
            <p className="mt-3 text-sm font-black text-[color:var(--px-text)]">
              {hasLocation ? "Verified courier location available" : "Location not available"}
            </p>
            <p className="mt-1 text-xs leading-5 text-[color:var(--px-text-muted)]">
              {hasLocation
                ? "Open the map to see the last reported area. It may not be the parcel's current position."
                : "We have not received a courier location. Showing a fake moving pin will mislead you."}
            </p>
          </div>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 pb-4 sm:px-5 sm:pb-5">
        <button
          aria-expanded={open}
          className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[color:var(--px-primary)] px-4 text-sm font-black text-white transition hover:bg-[color:var(--px-primary-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)]"
          onClick={() => {
            setOpen((old) => !old);
            setLoadFailed(false);
          }}
          type="button"
        >
          {open ? "Hide map" : "Open interactive map"}
        </button>
        <a
          className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-xs font-bold text-[color:var(--px-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)]"
          href={getTrackingMapExternalUrl(location)}
          rel="noopener noreferrer"
          target="_blank"
        >
          OpenStreetMap <ArrowUpRight aria-hidden size={15} />
        </a>
        <p className="w-full text-[11px] leading-5 text-[color:var(--px-text-muted)]">
          © OpenStreetMap contributors. Opening the map contacts OpenStreetMap.
          {hasLocation
            ? ` Carrier: ${location.carrierName}. Reported ${new Date(location.observedAt).toLocaleString("en-NG", { timeZone: "Africa/Lagos" })}.`
            : " This is a general map, not a live delivery tracker."}
        </p>
      </div>
    </section>
  );
}
