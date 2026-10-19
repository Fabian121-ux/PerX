"use client";

import { MapPin, MapPinOff } from "lucide-react";
import { useState } from "react";
import type { LogisticsV1Snapshot } from "@/lib/logistics/v1-server";

/** No map tiles or third-party requests until the viewer deliberately opens it. */
export function LogisticsV1DriverMap({ location, driverName }: {
  location: LogisticsV1Snapshot["location"];
  driverName: string;
}) {
  const [open, setOpen] = useState(false);
  const lat = location?.latitude ?? null;
  const lng = location?.longitude ?? null;
  const bounds = lat === null || lng === null ? null : [
    lng - 0.025, lat - 0.02, lng + 0.025, lat + 0.02,
  ].join(",");
  const url = bounds ? new URL("https://www.openstreetmap.org/export/embed.html") : null;
  if (url && lat !== null && lng !== null) {
    url.searchParams.set("bbox", bounds!);
    url.searchParams.set("layer", "mapnik");
    url.searchParams.set("marker", `${lat},${lng}`);
  }
  return (
    <section className="overflow-hidden rounded-2xl border border-[color:var(--px-border)] bg-[color:var(--px-surface)]">
      <div className="flex items-center justify-between gap-3 p-4">
        <div>
          <h2 className="flex items-center gap-2 font-black text-[color:var(--px-text)]">
            <MapPin aria-hidden size={18} className="text-[color:var(--px-primary)]" /> Live location
          </h2>
          <p className="mt-1 text-sm text-[color:var(--px-text-muted)]">
            {location ? `Last shared area from ${driverName}. Updates stop when sharing ends.` : "No current driver location available."}
          </p>
        </div>
        {location ? (
          <button type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)}
            className="min-h-11 shrink-0 rounded-xl bg-[color:var(--px-primary)] px-3 text-sm font-black text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)]">
            {open ? "Hide map" : "Show map"}
          </button>
        ) : <MapPinOff aria-label="Location unavailable" className="text-[color:var(--px-text-muted)]" />}
      </div>
      {location && open && url ? (
        <iframe key={url.toString()} className="h-72 w-full border-0 sm:h-96" loading="lazy"
          referrerPolicy="no-referrer" src={url.toString()} title="Approximate opt-in driver location on OpenStreetMap" />
      ) : (
        <div className="m-4 mt-0 grid min-h-40 place-items-center rounded-2xl border border-dashed border-[color:var(--px-border-strong)] bg-[color:var(--px-surface-soft)] p-4 text-center text-sm text-[color:var(--px-text-muted)]">
          {location ? "Tap Show map to load OpenStreetMap. Your driver has explicitly enabled sharing." :
            "The driver must accept the job and enable GPS sharing on their own device."}
        </div>
      )}
      {location ? (
        <p className="px-4 pb-3 text-xs leading-5 text-[color:var(--px-text-muted)]">
          Last GPS report: {new Date(location.observedAt).toLocaleTimeString("en-NG")}.
          Accuracy of the phone: approximately {Math.round(location.accuracyMetres ?? 0)} metres.
          Position rounded for privacy. © OpenStreetMap contributors.
        </p>
      ) : null}
    </section>
  );
}
