"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

const storagePrefix = "ptahx-scroll:";

export function AppScrollRestoration() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const key = `${storagePrefix}${pathname}?${searchParams.toString()}`;

  useEffect(() => {
    if ("scrollRestoration" in window.history) window.history.scrollRestoration = "manual";
    const main = document.querySelector<HTMLElement>(".dashboard-main");
    if (!main) return;

    const saved = sessionStorage.getItem(key);
    if (saved) {
      window.requestAnimationFrame(() => {
        let position: { top?: number; navLeft?: number } = {};
        try {
          position = JSON.parse(saved) as { top?: number; navLeft?: number };
        } catch {
          position = { top: Number(saved) || 0 };
        }
        main.scrollTo({ top: position.top ?? 0 });
        if (typeof position.navLeft === "number") {
          const activeNav = document.querySelector<HTMLElement>(
            "nav[role='tablist'], [data-scroll-nav='true']",
          );
          activeNav?.scrollTo({ left: position.navLeft });
        }
        sessionStorage.removeItem(key);
      });
    }

    const save = () => {
      sessionStorage.setItem(key, JSON.stringify({ top: main.scrollTop }));
    };

    const saveDestination = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const link = target.closest<HTMLAnchorElement>("a[href]");
      if (!link || link.target || event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const nav = link.closest<HTMLElement>(
        "nav[role='tablist'], [data-scroll-nav='true']",
      );
      if (!nav) return;

      const destination = new URL(link.href, window.location.href);
      if (destination.origin !== window.location.origin) return;
      const destinationKey = `${storagePrefix}${destination.pathname}?${destination.searchParams.toString()}`;
      sessionStorage.setItem(
        destinationKey,
        JSON.stringify({ top: main.scrollTop, navLeft: nav.scrollLeft }),
      );
    };

    main.addEventListener("scroll", save, { passive: true });
    document.addEventListener("click", saveDestination, true);
    window.addEventListener("pagehide", save);
    return () => {
      save();
      main.removeEventListener("scroll", save);
      document.removeEventListener("click", saveDestination, true);
      window.removeEventListener("pagehide", save);
    };
  }, [key]);

  return null;
}
