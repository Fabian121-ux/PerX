"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/**
 * A real activity indicator, not a made-up progress percentage. Pointer
 * feedback remains instant; this appears only for slower route changes.
 */
export function NavigationProgress() {
  const pathname = usePathname();
  const [pending, setPending] = useState(false);
  const startTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fallbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (startTimer.current) clearTimeout(startTimer.current);
    if (fallbackTimer.current) clearTimeout(fallbackTimer.current);
    startTimer.current = null;
    fallbackTimer.current = null;
    setPending(false);
  }, [pathname]);

  useEffect(() => {
    const start = () => {
      if (startTimer.current) clearTimeout(startTimer.current);
      if (fallbackTimer.current) clearTimeout(fallbackTimer.current);
      startTimer.current = setTimeout(() => setPending(true), 140);
      fallbackTimer.current = setTimeout(() => setPending(false), 8_000);
    };
    const onClick = (event: MouseEvent) => {
      if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      if (!(event.target instanceof Element)) return;
      const link = event.target.closest<HTMLAnchorElement>("a[href]");
      if (!link || link.download || link.target === "_blank" ||
        link.getAttribute("aria-disabled") === "true") return;
      let dest: URL;
      try { dest = new URL(link.href, window.location.href); } catch { return; }
      if (dest.origin !== window.location.origin ||
        dest.pathname === window.location.pathname) return;
      start();
    };
    const onPopState = () => start();
    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", onPopState);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", onPopState);
      if (startTimer.current) clearTimeout(startTimer.current);
      if (fallbackTimer.current) clearTimeout(fallbackTimer.current);
    };
  }, []);

  return pending ? (
    <div
      aria-label="Opening page"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-0 z-[110] h-1 overflow-hidden bg-[color:var(--px-primary-soft)]"
      role="status"
    >
      <div className="h-full w-1/3 animate-[ptahx-route-progress_1.25s_ease-in-out_infinite] bg-[color:var(--px-primary)] motion-reduce:animate-none" />
      <span className="sr-only">Opening page</span>
    </div>
  ) : null;
}
