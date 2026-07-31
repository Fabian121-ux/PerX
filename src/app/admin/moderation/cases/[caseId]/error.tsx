"use client";

import { AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function AdminCaseError({ reset }: { reset: () => void }) {
  return (
    <div className="rounded-[var(--px-radius)] border border-red-200 bg-red-50 p-6 text-red-950">
      <AlertCircle aria-hidden className="mb-3" size={24} />
      <h2 className="text-lg font-black">This case could not be fully loaded</h2>
      <p className="mt-2 text-sm leading-6">
        Review available metadata or retry. Private evidence, stack traces and
        database details are not displayed in the browser.
      </p>
      <Button className="mt-4" onClick={() => reset()} type="button" variant="secondary">
        Retry
      </Button>
    </div>
  );
}
