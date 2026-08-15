"use client";

import Link from "next/link";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

import { useToast } from "@/components/ui/feedback-provider";
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
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const toast = useToast();

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
    event.preventDefault();
    setPending(true);
    router.push(href);
    void markNotificationAsReadAction(notificationId)
      .then(() => {
        window.dispatchEvent(new Event("perx-unread-refresh"));
      })
      .catch(() => {
        toast({
          description:
            "The destination is opening, but this update remains unread.",
          title: "Could not mark this update read",
          tone: "error",
        });
      });
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
      {pending ? (
        <>
          <Loader2
            aria-hidden
            className="animate-spin motion-reduce:animate-none"
            size={15}
          />
          Opening...
        </>
      ) : (
        children
      )}
    </Link>
  );
}
