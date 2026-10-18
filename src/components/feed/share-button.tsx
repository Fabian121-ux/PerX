"use client";

import { Share2 } from "lucide-react";
import { useState } from "react";

/** Native sharing where supported, with a copy-link fallback. No server writes. */
export function ShareButton({
  href,
  label = "Share",
}: {
  href: string;
  label?: string;
}) {
  const [status, setStatus] = useState("");
  const share = async () => {
    const url = new URL(href, window.location.origin).toString();
    setStatus("");
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ url });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        setStatus("Link copied");
      } else {
        setStatus("Sharing is unavailable on this device.");
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setStatus("Unable to share. Please try again.");
    }
  };
  return (
    <span className="inline-flex min-w-0 flex-col">
      <button
        aria-label={label}
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 text-sm font-bold text-[color:var(--px-text-muted)] transition hover:bg-[color:var(--px-muted)] hover:text-[color:var(--px-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)]"
        onClick={() => void share()}
        type="button"
      >
        <Share2 aria-hidden size={17} />
        {label}
      </button>
      {status ? <span className="text-xs text-[color:var(--px-text-muted)]" role="status">{status}</span> : null}
    </span>
  );
}
