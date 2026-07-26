"use client";

import { useEffect } from "react";

export function PresenceHeartbeat() {
  useEffect(() => {
    let stopped = false;

    const sendHeartbeat = () => {
      if (stopped || document.visibilityState !== "visible") return;
      fetch("/api/presence/heartbeat", {
        cache: "no-store",
        method: "POST",
      }).catch(() => undefined);
    };

    sendHeartbeat();
    const interval = window.setInterval(sendHeartbeat, 60_000);
    document.addEventListener("visibilitychange", sendHeartbeat);

    return () => {
      stopped = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", sendHeartbeat);
    };
  }, []);

  return null;
}
