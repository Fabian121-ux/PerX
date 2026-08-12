"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition, type ReactNode } from "react";

import { useToast } from "@/components/ui/feedback-provider";
import { openNotificationAction } from "@/features/notifications/actions";

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
  const [pending, startTransition] = useTransition();
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
    startTransition(async () => {
      try {
        await openNotificationAction(notificationId);
      } catch (error) {
        if ((error as { digest?: string })?.digest?.startsWith("NEXT_REDIRECT")) {
          return;
        }
        toast({
          description: "Your notification remains unread. Please try again.",
          title: "Could not open this update",
          tone: "error",
        });
        router.push(href);
      }
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
      {children}
    </Link>
  );
}
