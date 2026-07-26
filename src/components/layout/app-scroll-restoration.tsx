"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

const storagePrefix = "perx-scroll:";

export function AppScrollRestoration() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const key = `${storagePrefix}${pathname}?${searchParams.toString()}`;

  useEffect(() => {
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }

    const main = document.querySelector<HTMLElement>(".dashboard-main");
    if (!main) return;

    const saved = sessionStorage.getItem(key);
    if (saved) {
      window.requestAnimationFrame(() => {
        main.scrollTo({ top: Number(saved) || 0 });
      });
    }

    const save = () => {
      sessionStorage.setItem(key, String(main.scrollTop));
    };

    main.addEventListener("scroll", save, { passive: true });
    window.addEventListener("pagehide", save);
    return () => {
      save();
      main.removeEventListener("scroll", save);
      window.removeEventListener("pagehide", save);
    };
  }, [key]);

  return null;
}
