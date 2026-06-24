"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";

interface FeatureStatusDialogProps {
  children: ReactNode;
  featureName?: string;
  explanation?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function FeatureStatusDialog({
  children,
  featureName,
  explanation,
  open,
  onOpenChange,
}: FeatureStatusDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Trigger asChild>{children}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-[50%] top-[50%] z-[101] grid w-full max-w-md translate-x-[-50%] translate-y-[-50%] gap-4 border border-[color:var(--px-border)] bg-[color:var(--px-surface)] p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-[24px]">
          <div className="flex flex-col gap-2">
            <Dialog.Title className="text-lg font-semibold text-[color:var(--px-text)]">
              Feature under development
            </Dialog.Title>
            <Dialog.Description className="text-sm text-[color:var(--px-text-muted)]">
              {explanation || "This feature is being prepared for a future perX update."}
              {featureName && (
                <span className="mt-2 block font-medium text-[color:var(--px-primary)]">
                  {featureName}
                </span>
              )}
            </Dialog.Description>
          </div>
          <div className="mt-4 flex justify-end">
            <Dialog.Close asChild>
              <button className="rounded-xl bg-[color:var(--px-muted)] px-4 py-2 text-sm font-semibold text-[color:var(--px-text)] hover:bg-[color:var(--px-border)]">
                Close
              </button>
            </Dialog.Close>
          </div>
          <Dialog.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-[color:var(--px-primary)] focus:ring-offset-2 disabled:pointer-events-none">
            <X className="h-4 w-4 text-[color:var(--px-text)]" />
            <span className="sr-only">Close</span>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
