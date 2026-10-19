"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function LogisticsV1DispatchForm({ dealId }: { dealId: string }) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError("");
    try {
      const result = await fetch("/api/logistics/v1/shipments", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dealId, driverUsername: username.trim() }),
      });
      const body = await result.json() as { href?: string; error?: string };
      if (result.ok && body.href?.startsWith("/app/logistics/shipments/")) {
        router.push(body.href);
      } else setError(body.error ?? "Unable to arrange the delivery.");
    } catch {
      setError("Network problem. Try again.");
    } finally {
      setPending(false);
    }
  }
  return (
    <form onSubmit={(e) => void submit(e)} className="space-y-4 rounded-[22px] border border-[color:var(--px-border)] bg-[color:var(--px-surface)] p-5">
      <label className="block space-y-2 text-sm font-bold text-[color:var(--px-text)]" htmlFor="driver-username">
        Driver's PtahX username
        <input id="driver-username" autoComplete="off" required minLength={2} maxLength={48}
          value={username} onChange={(event) => setUsername(event.target.value)}
          placeholder="e.g. alexdriver"
          className="block min-h-12 w-full rounded-xl border border-[color:var(--px-border-strong)] bg-[color:var(--px-surface)] px-3 text-[color:var(--px-text)] placeholder:text-[color:var(--px-text-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)]" />
      </label>
      <p className="text-sm leading-6 text-[color:var(--px-text-muted)]">
        The driver needs their own PtahX account. Their GPS stays off until they accept and enable it.
        This does not book a courier, charge payment or create a new order.
      </p>
      <button type="submit" disabled={pending}
        className="min-h-11 rounded-xl bg-[color:var(--px-primary)] px-5 text-sm font-black text-white disabled:opacity-60">
        {pending ? "Assigning..." : "Assign driver for this product"}
      </button>
      {error ? <p role="alert" className="text-sm text-[color:var(--px-error)]">{error}</p> : null}
    </form>
  );
}
