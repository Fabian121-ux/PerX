"use client";

import { RefreshCcw, WifiOff, X } from "lucide-react";
import { InstallAppNudge } from "@/components/pwa/install-app-nudge";
import { useEffect, useRef, useState } from "react";

/**
 * Lightweight PWA lifecycle feedback. Only public assets are cached by sw.js.
 * Updates are applied on request: never reload somebody halfway through a
 * payment, form submission or live conversation.
 */
export function ServiceWorkerRegister() {
  const [offline, setOffline] = useState(false);
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const [updateDismissed, setUpdateDismissed] = useState(false);
  const approvedReload = useRef(false);

  useEffect(() => {
    const updateOnlineState = () => setOffline(!navigator.onLine);
    updateOnlineState();
    window.addEventListener("offline", updateOnlineState);
    window.addEventListener("online", updateOnlineState);

    return () => {
      window.removeEventListener("offline", updateOnlineState);
      window.removeEventListener("online", updateOnlineState);
    };
  }, []);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || process.env.NODE_ENV !== "production") return;

    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const onControllerChanged = () => {
      if (approvedReload.current) window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChanged);

    const register = () => {
      void navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" })
        .then((registration) => {
          if (disposed) return;
          if (registration.waiting && navigator.serviceWorker.controller) {
            setWaiting(registration.waiting);
          }
          const showWaitingUpdate = () => {
            const installing = registration.installing;
            if (!installing) return;
            installing.addEventListener("statechange", () => {
              if (
                !disposed &&
                installing.state === "installed" &&
                navigator.serviceWorker.controller
              ) {
                setWaiting(registration.waiting || installing);
              }
            });
          };
          registration.addEventListener("updatefound", showWaitingUpdate);
        })
        .catch(() => {
          // PWA support is an enhancement; it cannot block regular navigation.
        });
    };

    // Let the critical page image, fonts and navigation complete first.
    if (document.readyState === "complete") timer = setTimeout(register, 1200);
    else {
      const onLoaded = () => { timer = setTimeout(register, 1200); };
      window.addEventListener("load", onLoaded, { once: true });
      return () => {
        disposed = true;
        window.removeEventListener("load", onLoaded);
        if (timer) clearTimeout(timer);
        navigator.serviceWorker.removeEventListener("controllerchange", onControllerChanged);
      };
    }
    return () => {
      disposed = true;
      if (timer) clearTimeout(timer);
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChanged);
    };
  }, []);

  const showUpdate = Boolean(waiting && !updateDismissed && !offline);
  if (!offline && !showUpdate) return <InstallAppNudge />;

  return (
    <>
      <InstallAppNudge />
    <div
      aria-label="App connection and install status"
      className="pointer-events-none fixed inset-x-3 top-[5rem] z-[85] mx-auto max-w-sm space-y-2 sm:inset-x-auto sm:right-5"
    >
      {offline ? (
        <div className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-amber-300 bg-[#fff5d9] px-4 py-3 text-sm font-semibold text-[#513c12] shadow-xl dark:border-amber-500/50 dark:bg-[#3b311b] dark:text-amber-100" role="status">
          <WifiOff aria-hidden size={20} className="shrink-0" />
          <span className="flex-1">Device offline. Live chats and changes need internet.</span>
        </div>
      ) : null}
      {showUpdate ? (
        <div className="pointer-events-auto flex items-center gap-2 rounded-2xl border border-[color:var(--px-border-strong)] bg-[color:var(--px-surface-elevated)] p-3 text-[color:var(--px-text)] shadow-xl" role="status">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black">PtahX update ready</p>
            <p className="text-xs text-[color:var(--px-text-muted)]">Save your work before updating.</p>
          </div>
          <button
            className="inline-flex min-h-11 items-center gap-1 rounded-xl bg-[color:var(--px-primary)] px-3 text-xs font-bold text-white"
            onClick={() => {
              if (!waiting) return;
              approvedReload.current = true;
              waiting.postMessage({ type: "SKIP_WAITING" });
            }}
            type="button"
          >
            <RefreshCcw aria-hidden size={16} /> Update
          </button>
          <button aria-label="Dismiss update notice" className="grid h-11 w-11 place-items-center" onClick={() => setUpdateDismissed(true)} type="button"><X aria-hidden size={17} /></button>
        </div>
      ) : null}

    </div>
    </>
  );
}
