"use client";

import { startTransition, useEffect, useEffectEvent } from "react";
import { useRouter } from "next/navigation";

import { markVisibleNewsAsReadAction } from "@/features/notifications/actions";

export function NewsReadMarker({
  notificationIds,
}: {
  notificationIds: string[];
}) {
  const router = useRouter();
  const notificationKey = notificationIds.join(",");
  const markVisibleNewsRead = useEffectEvent(() => {
    startTransition(async () => {
      try {
        await markVisibleNewsAsReadAction(notificationIds);
        window.dispatchEvent(new Event("perx-unread-refresh"));
        router.refresh();
      } catch {
        // Polling leaves the current indicator intact until a later successful read.
      }
    });
  });

  useEffect(() => {
    if (notificationKey) markVisibleNewsRead();
  }, [notificationKey]);

  return null;
}
