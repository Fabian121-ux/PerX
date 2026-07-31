"use client";

import { AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function AdminMessagesError({ reset }: { reset: () => void }) {
  return (
    <div className="rounded-[var(--px-radius)] border border-red-200 bg-red-50 p-6 text-red-950">
      <AlertCircle aria-hidden className="mb-3" size={24} />
      <h2 className="text-lg font-black">Message cases could not be fully loaded</h2>
      <p className="mt-2 text-sm leading-6">
        Review available audit metadata or retry. Private message contents and
        internal error details are not shown here.
      </p>
      <Button className="mt-4" onClick={() => reset()} type="button" variant="secondary">
        Retry
      </Button>
    </div>
  );
}
