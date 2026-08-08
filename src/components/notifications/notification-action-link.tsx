"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";

import { markNotificationAsReadAction } from "@/features/notifications/actions";

export function NotificationActionLink({
  ariaLabel,
  children,
  className,
  href,
  notificationId,
}: {
  ariaLabel?: string;
  children?: ReactNode;
  className?: string;
  href: string;
  notificationId: string;
}) {
  const [pending, setPending] = useState(false);

  const handleClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }
    if (pending) {
      event.preventDefault();
      return;
    }
    setPending(true);
    void markNotificationAsReadAction(notificationId)
      .then(() => window.dispatchEvent(new Event("perx-unread-refresh")))
      .catch(() => setPending(false));
  };

  return (
    <Link
      aria-busy={pending || undefined}
      aria-label={ariaLabel}
      className={`${className ?? ""} ${pending ? "cursor-wait" : ""}`}
      href={href}
      onClick={handleClick}
      prefetch={false}
    >
      {children}
    </Link>
  );
}
