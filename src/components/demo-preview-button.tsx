"use client";

import { ButtonLink } from "@/components/ui/button";

export function DemoPreviewButton() {
  return (
    <div className="grid gap-3">
      <ButtonLink href="/preview" variant="warm" className="w-full">
        Enter Demo Preview
      </ButtonLink>
      <p className="text-center text-xs leading-5 text-[color:var(--px-text-muted)]">
        Quick local UI preview. No database or configuration required.
      </p>
    </div>
  );
}
