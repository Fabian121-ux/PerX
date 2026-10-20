"use client";

import { useEffect, useState } from "react";
import { useReportWebVitals } from "next/web-vitals";

type Vital = {
  name: string;
  value: number;
  rating: string;
};
const STORAGE_KEY = "ptahx:vitals:session:v1";
const NAMES = new Set(["LCP", "CLS", "INP", "FCP", "TTFB"]);
const MAX_SAMPLES = 10;

function readVitals(): Vital[] {
  try {
    const data = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "[]") as unknown;
    return Array.isArray(data) ? data.filter((v): v is Vital =>
      v && typeof v.name === "string" && typeof v.value === "number" &&
      typeof v.rating === "string" && NAMES.has(v.name),
    ).slice(-MAX_SAMPLES) : [];
  } catch {
    return [];
  }
}

/** Local real-user metrics with no backend, cookies, URL or personal data. */
export function PerformanceVitals() {
  const [visible, setVisible] = useState(false);
  const [vitals, setVitals] = useState<Vital[]>([]);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("perf") === "1") {
      setVisible(true);
      setVitals(readVitals());
    }
  }, []);

  useReportWebVitals((metric) => {
    if (!NAMES.has(metric.name) || !Number.isFinite(metric.value)) return;
    const recent = readVitals().filter((v) => v.name !== metric.name);
    const next = [...recent, {
      name: metric.name,
      value: Math.round(metric.value * 1_000) / 1_000,
      rating: metric.rating,
    }].slice(-MAX_SAMPLES);
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Browsers with restricted storage still load PtahX normally.
    }
    // Only local, opt-in diagnostics. Never send metrics to Supabase or a
    // shared analytics endpoint from millions of page views by default.
    if (new URLSearchParams(window.location.search).get("perf") === "1") {
      setVitals(next);
    }
  });

  if (!visible) return null;
  return (
    <aside
      aria-label="Local web performance"
      className="fixed bottom-[calc(var(--mobile-nav-height)+1.25rem)] right-3 z-[80] w-[min(19rem,calc(100vw-1.5rem))] rounded-2xl border border-[color:var(--px-border-strong)] bg-[color:var(--px-surface-elevated)] p-4 text-[color:var(--px-text)] shadow-2xl lg:bottom-5"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-black">Page speed diagnostics</h2>
          <p className="mt-1 text-xs text-[color:var(--px-text-muted)]">This device only. No data uploaded.</p>
        </div>
        <button type="button" onClick={() => setVisible(false)} className="min-h-11 rounded-lg px-2 text-xs font-bold text-[color:var(--px-primary-ink)]">Close</button>
      </div>
      <dl className="mt-2 grid gap-2 text-xs">
        {vitals.length ? vitals.map((metric) => (
          <div className="flex items-center justify-between gap-2" key={metric.name}>
            <dt className="font-bold">{metric.name}</dt>
            <dd className="text-right">
              {metric.name === "CLS" ? metric.value.toFixed(3) : `${Math.round(metric.value)} ms`} · {metric.rating}
            </dd>
          </div>
        )) : <p className="text-[color:var(--px-text-muted)]">Measuring this page. Interact or navigate to collect results.</p>}
      </dl>
    </aside>
  );
}
