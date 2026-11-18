"use client";

import { Bell, BellOff, Check, LoaderCircle, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";

const categories = [
  { id: "messages", label: "Messages" },
  { id: "connections", label: "Connections" },
  { id: "deals", label: "Deals and proposals" },
  { id: "opportunities", label: "Opportunities" },
  { id: "system", label: "Account and platform updates" },
] as const;
type Category = (typeof categories)[number]["id"];

function isInstalledPwa() {
  const standalone = window.matchMedia?.("(display-mode: standalone)").matches ?? false;
  const ios = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return standalone || ios;
}
function decodeKey(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalized + "=".repeat((4 - normalized.length % 4) % 4));
  return Uint8Array.from(raw, (character) => character.charCodeAt(0));
}

export function PushNotificationManager({ mode = "banner" }: { mode?: "banner" | "settings" }) {
  const [supported, setSupported] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [selected, setSelected] = useState<Category[]>(categories.map((item) => item.id));
  const [busy, setBusy] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const available = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    setSupported(available);
    setInstalled(isInstalledPwa());
    if (!available) return;
    setPermission(Notification.permission);
    let active = true;
    fetch("/api/push/subscriptions", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then(async (data) => {
        if (!active || !data) return;
        setPublicKey(data.publicKey);
        setEnabled(Boolean(data.enabled));
        if (data.enabled) {
          const registration = await navigator.serviceWorker.ready;
          const subscription = await registration.pushManager.getSubscription();
          if (subscription) {
            const current = await subscription.toJSON();
            if (current.keys?.p256dh && current.keys.auth) {
              // Keep this device's category selection aligned with account settings.
            }
          }
        }
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  async function enable() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      if (!supported || !publicKey) throw new Error("Push notifications are not available on this browser yet.");
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result !== "granted") throw new Error("Allow notifications in your browser settings to continue.");
      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: decodeKey(publicKey),
        });
      }
      const response = await fetch("/api/push/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...subscription.toJSON(), categories: selected }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not enable notifications.");
      setEnabled(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not enable notifications.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setError(null);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await fetch("/api/push/subscriptions", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        await subscription.unsubscribe();
      }
      setEnabled(false);
    } catch {
      setError("Could not disable notifications on this device.");
    } finally {
      setBusy(false);
    }
  }

  async function saveCategories() {
    setBusy(true);
    setError(null);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (!subscription) throw new Error("Enable notifications on this device first.");
      const response = await fetch("/api/push/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...subscription.toJSON(), categories: selected }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not save preferences.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save preferences.");
    } finally {
      setBusy(false);
    }
  }

  if (mode === "banner") {
    if (!installed || !supported || !publicKey || enabled || permission === "denied" || dismissed) return null;
    return (
      <aside className="fixed inset-x-3 bottom-[max(1rem,env(safe-area-inset-bottom))] z-[88] mx-auto flex max-w-lg items-center gap-3 rounded-2xl border border-[color:var(--px-border-strong)] bg-[color:var(--px-surface-elevated)] p-4 text-[color:var(--px-text)] shadow-2xl" aria-label="Enable preX notifications">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[color:var(--px-primary-soft)] text-[color:var(--px-primary)]"><Bell size={20} /></span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black">Stay updated on preX</p>
          <p className="text-xs leading-5 text-[color:var(--px-text-muted)]">Get message and important activity alerts, even when the app is closed.</p>
        </div>
        <button type="button" disabled={busy} onClick={() => void enable()} className="min-h-10 rounded-xl bg-[color:var(--px-primary)] px-3 text-xs font-bold text-white disabled:opacity-60">
          {busy ? <LoaderCircle className="animate-spin" size={16} /> : "Enable"}
        </button>
        <button type="button" onClick={() => setDismissed(true)} aria-label="Dismiss notification prompt" className="min-h-10 px-1 text-xs text-[color:var(--px-text-muted)]">Later</button>
      </aside>
    );
  }

  return (
    <section className="grid gap-4">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[color:var(--px-primary-soft)] text-[color:var(--px-primary)]"><Smartphone size={21} /></span>
        <div className="min-w-0 flex-1">
          <h2 className="font-bold">Push notifications on this device</h2>
          <p className="mt-1 text-sm leading-6 text-[color:var(--px-text-muted)]">Receive selected preX updates when the installed app is closed. Notifications require device permission and an internet connection.</p>
        </div>
      </div>
      {!installed ? <p className="rounded-xl bg-[color:var(--px-surface-soft)] p-3 text-sm text-[color:var(--px-text-muted)]">Install preX to your Home Screen to enable reliable app-style notifications on iPhone. Android browsers may also support browser push.</p> : null}
      {!supported ? <p className="text-sm text-[color:var(--px-text-muted)]">This browser does not support web push notifications.</p> : null}
      {permission === "denied" ? <p className="text-sm text-amber-700">Notifications are blocked by your browser. Change the site permission in your device settings.</p> : null}
      <div className="flex flex-wrap gap-2">
        {enabled ? <button type="button" disabled={busy} onClick={() => void disable()} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[color:var(--px-border)] px-4 text-sm font-bold"><BellOff size={17} /> Turn off on this device</button> : <button type="button" disabled={busy || !supported || !publicKey || permission === "denied"} onClick={() => void enable()} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[color:var(--px-primary)] px-4 text-sm font-bold text-white disabled:opacity-50">{busy ? <LoaderCircle className="animate-spin" size={17} /> : <Bell size={17} />} Enable notifications</button>}
        {enabled ? <span className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-700"><Check size={16} /> Enabled on this device</span> : null}
      </div>
      {enabled ? <div className="grid gap-2 rounded-xl border border-[color:var(--px-border)] p-3">
        <p className="text-sm font-bold">Notification categories</p>
        {categories.map((category) => <label key={category.id} className="flex min-h-10 items-center gap-3 text-sm"><input type="checkbox" checked={selected.includes(category.id)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, category.id] : current.filter((item) => item !== category.id))} />{category.label}</label>)}
        <button type="button" disabled={busy} onClick={() => void saveCategories()} className="min-h-10 justify-self-start rounded-lg border border-[color:var(--px-border)] px-3 text-sm font-semibold">Save preferences</button>
      </div> : null}
      {error ? <p role="alert" className="text-sm text-red-600">{error}</p> : null}
      {mode === "settings" && !enabled && supported && !publicKey ? <p className="text-sm text-[color:var(--px-text-muted)]">Push delivery is being configured. Try again later.</p> : null}
    </section>
  );
}
