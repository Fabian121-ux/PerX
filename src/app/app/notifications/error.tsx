"use client";

import { CircleAlert, RotateCcw } from "lucide-react";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function NotificationsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Notification center failed to load", error);
  }, [error]);

  return (
    <section className="mx-auto grid min-h-[55dvh] max-w-xl place-items-center px-4 text-center">
      <div>
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-red-500/10 text-[color:var(--px-error)]">
          <CircleAlert aria-hidden size={24} />
        </span>
        <h1 className="mt-4 text-xl font-black text-[color:var(--px-text)]">
          Activity could not be loaded
        </h1>
        <p className="mt-2 text-sm leading-6 text-[color:var(--px-text-muted)]">
          Your updates remain safe. Check your connection and retry this view.
        </p>
        <Button className="mt-5" onClick={reset} type="button">
          <RotateCcw aria-hidden className="mr-2" size={16} />
          Retry
        </Button>
      </div>
    </section>
  );
}
