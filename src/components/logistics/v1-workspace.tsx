"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, LocateFixed, RefreshCw, ShieldCheck, Truck, X } from "lucide-react";

import { LogisticsV1DriverMap } from "@/components/logistics/v1-driver-map";
import type { LogisticsV1Snapshot } from "@/lib/logistics/v1-server";
import {
  GPS_MIN_INTERVAL_MS, LOGISTICS_V1_POLL_MS,
} from "@/lib/logistics/v1-policy";

type Action =
  | "accept" | "start" | "stop" | "position" | "picked_up"
  | "in_transit" | "delivered" | "cancel";

export function LogisticsV1Workspace({ initial }: { initial: LogisticsV1Snapshot }) {
  const [shipment, setShipment] = useState(initial);
  const [minutes, setMinutes] = useState<15 | 30 | 60 | 120>(30);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const watchId = useRef<number | null>(null);
  const lastSent = useRef(0);
  const expiryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const busy = useRef(false);
  const endpoint = `/api/logistics/v1/shipments/${encodeURIComponent(shipment.id)}`;

  const stopLocalWatch = useCallback(() => {
    if (watchId.current !== null && typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
    if (expiryTimer.current !== null) {
      clearTimeout(expiryTimer.current);
      expiryTimer.current = null;
    }
  }, []);

  const refresh = useCallback(async () => {
    if (document.visibilityState !== "visible" || busy.current) return;
    try {
      const res = await fetch(endpoint, { cache: "no-store" });
      if (!res.ok) return;
      const next = await res.json() as LogisticsV1Snapshot;
      setShipment(next);
      if (!next.sharing && watchId.current !== null) stopLocalWatch();
    } catch {
      // Keep last confirmed state; never invent a new location.
    }
  }, [endpoint, stopLocalWatch]);

  useEffect(() => {
    const ticker = setInterval(() => {
      const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
      if (!conn?.saveData) void refresh();
    }, LOGISTICS_V1_POLL_MS);
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void refresh();
      } else if (watchId.current !== null) {
        // V1 is foreground-only: do not keep consuming device GPS when hidden.
        stopLocalWatch();
        void fetch(endpoint, {
          method: "POST", credentials: "same-origin", keepalive: true,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "stop" }),
        }).catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearInterval(ticker);
      document.removeEventListener("visibilitychange", onVisibility);
      stopLocalWatch();
    };
  }, [refresh, stopLocalWatch, endpoint]);

  async function postAction(action: Action, extra: Record<string, unknown> = {}) {
    if (busy.current) return null;
    busy.current = true;
    setPending(true);
    setMessage("");
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      const result = await res.json() as LogisticsV1Snapshot & { error?: string };
      if (!res.ok) {
        setMessage(result.error ?? "Update not saved. Try again.");
        return null;
      }
      setShipment(result);
      return result;
    } catch {
      setMessage("Network unavailable. No change was confirmed.");
      return null;
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  const stopSharing = useCallback(async () => {
    stopLocalWatch();
    await postAction("stop");
    // explicit server stop is required; local stop works even if offline.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopLocalWatch, endpoint]);

  const startSharing = async () => {
    if (!navigator.geolocation || !window.isSecureContext) {
      setMessage("GPS requires HTTPS and a phone/browser with location support.");
      return;
    }
    stopLocalWatch();
    const started = await postAction("start", { minutes });
    if (!started) return;
    const ms = new Date(started.sharingUntil ?? "").getTime() - Date.now();
    if (!Number.isFinite(ms) || ms <= 0) { setMessage("Sharing session expired."); return; }
    expiryTimer.current = setTimeout(() => {
      stopLocalWatch();
      setMessage("GPS sharing duration has ended.");
      void postAction("stop");
    }, ms);
    setMessage("Please allow GPS access. Keep this driver page open while sharing.");
    lastSent.current = 0;
    watchId.current = navigator.geolocation.watchPosition(
      (position) => {
        if (document.visibilityState !== "visible") return;
        const now = Date.now();
        if (now - lastSent.current < GPS_MIN_INTERVAL_MS) return;
        const { latitude, longitude, accuracy } = position.coords;
        if (accuracy > 300) {
          setMessage("GPS accuracy is too low. Move where the sky is clearer.");
          return;
        }
        lastSent.current = now;
        void postAction("position", { latitude, longitude, accuracy });
      },
      (error) => {
        stopLocalWatch();
        setMessage(error.code === 1
          ? "Location permission declined. GPS sharing has been stopped."
          : "Phone could not provide GPS. Sharing has been stopped.");
        void postAction("stop");
      },
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 20_000 },
    );
  };

  const isDriver = shipment.role === "driver";
  const isBuyer = shipment.role === "buyer";
  const done = ["DELIVERED", "CANCELLED"].includes(shipment.status);
  return (
    <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="min-w-0 space-y-4">
        <section className="rounded-[22px] border border-[color:var(--px-border)] bg-[color:var(--px-surface)] p-5">
          <p className="text-xs font-black uppercase tracking-wide text-[color:var(--px-primary)]">PtahX Logistics V1</p>
          <h2 className="mt-2 text-xl font-black text-[color:var(--px-text)]">Delivery progress</h2>
          <p className="mt-2 text-sm text-[color:var(--px-text-muted)]">Driver: {shipment.driverName}</p>
          <div className="mt-3 rounded-xl bg-[color:var(--px-primary-soft)] p-4 text-lg font-black text-[color:var(--px-primary)]">
            {shipment.status.replaceAll("_", " ").toLowerCase()}
          </div>
          <p className="mt-3 text-sm leading-6 text-[color:var(--px-text-muted)]">
            This is a pilot delivery linked to an existing product agreement. It does not process payment or purchase postage.
          </p>
          <button type="button" onClick={() => void refresh()} disabled={pending}
            className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl border border-[color:var(--px-border)] px-4 text-sm font-bold text-[color:var(--px-text)] hover:bg-[color:var(--px-muted)]">
            <RefreshCw aria-hidden size={17} /> Check for updates
          </button>
        </section>

        {isDriver && !done ? (
          <section aria-label="Driver controls" className="space-y-4 rounded-[22px] border border-[color:var(--px-border)] bg-[color:var(--px-surface)] p-5">
            <h2 className="text-lg font-black text-[color:var(--px-text)]">Driver controls</h2>
            {shipment.status === "ASSIGNED" ? (
              <button type="button" disabled={pending} onClick={() => void postAction("accept")}
                className="min-h-11 rounded-xl bg-[color:var(--px-primary)] px-5 font-black text-white">
                Accept delivery
              </button>
            ) : <>
              <p className="flex items-start gap-2 text-sm leading-6 text-[color:var(--px-text-muted)]">
                <ShieldCheck aria-hidden className="mt-1 shrink-0 text-[color:var(--px-primary)]" size={19} />
                Only share your phone&apos;s location during this delivery. You can stop any time.
                The browser must remain open; hotspot access alone cannot share another person&apos;s position.
              </p>
              {!shipment.sharing ? (
                <div className="space-y-3">
                  <label className="block text-sm font-black text-[color:var(--px-text)]" htmlFor="gps-duration">Share GPS for</label>
                  <select id="gps-duration" value={minutes}
                    onChange={(e) => setMinutes(Number(e.target.value) as 15 | 30 | 60 | 120)}
                    className="min-h-11 w-full rounded-xl border border-[color:var(--px-border-strong)] bg-[color:var(--px-surface)] px-3 text-[color:var(--px-text)]">
                    {[15, 30, 60, 120].map((value) => <option key={value} value={value}>{value} minutes</option>)}
                  </select>
                  <button type="button" disabled={pending} onClick={() => void startSharing()}
                    className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-700 px-4 font-black text-white disabled:opacity-60">
                    <LocateFixed aria-hidden size={18} /> Enable live GPS
                  </button>
                </div>
              ) : <div className="space-y-2">
                <p className="font-black text-emerald-700 dark:text-emerald-300">
                  Sharing allowed until {shipment.sharingUntil ? new Date(shipment.sharingUntil).toLocaleTimeString("en-NG") : "expiry"}.
                </p>
                <p className="text-xs text-[color:var(--px-text-muted)]">
                  GPS only updates while your phone keeps this page open. If you left and came back, press Stop and restart.
                </p>
                <button type="button" disabled={pending} onClick={() => void stopSharing()}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-red-700 px-4 font-black text-white">
                  <X aria-hidden size={18} /> Stop sharing
                </button>
              </div>}
              {shipment.status === "ACCEPTED" ? (
                <button type="button" disabled={pending} onClick={() => void postAction("picked_up")}
                  className="min-h-11 rounded-xl border border-[color:var(--px-border-strong)] px-4 font-bold text-[color:var(--px-text)]">Confirm parcel collected</button>
              ) : null}
              {shipment.status === "PICKED_UP" ? (
                <button type="button" disabled={pending} onClick={() => void postAction("in_transit")}
                  className="min-h-11 rounded-xl border border-[color:var(--px-border-strong)] px-4 font-bold text-[color:var(--px-text)]">Confirm in transit</button>
              ) : null}
            </>}
          </section>
        ) : null}
        {isBuyer && ["PICKED_UP", "IN_TRANSIT"].includes(shipment.status) ? (
          <section className="rounded-2xl border border-[color:var(--px-border)] bg-[color:var(--px-surface)] p-5">
            <h2 className="font-black text-[color:var(--px-text)]">Did you receive the package?</h2>
            <p className="my-2 text-sm text-[color:var(--px-text-muted)]">Only confirm after the item has arrived. This ends GPS sharing.</p>
            <button type="button" disabled={pending} onClick={() => {
              if (window.confirm("Confirm you physically received this item?")) void postAction("delivered");
            }} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-700 px-4 font-black text-white">
              <CheckCircle2 aria-hidden size={18} /> Confirm received
            </button>
          </section>
        ) : null}
        {shipment.role === "seller" && ["ASSIGNED", "ACCEPTED"].includes(shipment.status) ? (
          <button type="button" disabled={pending} onClick={() => {
            if (window.confirm("Cancel this delivery assignment?")) void postAction("cancel");
          }} className="min-h-11 rounded-xl border border-[color:var(--px-border)] px-4 font-bold text-[color:var(--px-error)]">
            Cancel delivery
          </button>
        ) : null}
        {message ? <p role="status" className="rounded-xl bg-[color:var(--px-muted)] p-3 text-sm text-[color:var(--px-text)]">{message}</p> : null}
      </div>
      <aside className="min-w-0 space-y-4">
        <LogisticsV1DriverMap location={shipment.location} driverName={shipment.driverName} />
        <div className="rounded-2xl border border-[color:var(--px-border)] bg-[color:var(--px-surface)] p-4">
          <h3 className="flex items-center gap-2 font-black text-[color:var(--px-text)]"><Truck aria-hidden size={18} /> Low-data V1</h3>
          <p className="mt-2 text-sm leading-6 text-[color:var(--px-text-muted)]">
            Location is sent at most once every 25 seconds and only while the driver has GPS enabled on this open page.
            Buyers refresh every 30 seconds when viewing. No paid tracking service required.
          </p>
        </div>
      </aside>
    </div>
  );
}
