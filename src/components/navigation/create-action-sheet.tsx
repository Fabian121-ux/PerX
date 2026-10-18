"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { ArrowRight, X } from "lucide-react";
import Link from "next/link";
import { useState, type ReactElement } from "react";

import { createOptions } from "@/lib/navigation/create-options";

export function CreateActionSheet({ children }: { children: ReactElement }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>{children}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-[2px]" />
        <Dialog.Content className="fixed inset-x-0 bottom-0 z-[81] max-h-[90dvh] overflow-y-auto rounded-t-[28px] border border-[color:var(--px-border)] bg-[color:var(--px-surface)] px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-5 shadow-2xl focus:outline-none sm:bottom-auto sm:left-1/2 sm:right-auto sm:top-1/2 sm:w-[min(520px,calc(100vw-2rem))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[24px] sm:p-6">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="text-xl font-black text-[color:var(--px-text)]">
                What would you like to create?
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm leading-5 text-[color:var(--px-text-muted)]">
                Share an update with everyone, or publish a business opportunity.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button aria-label="Close Create menu" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[color:var(--px-muted)] text-[color:var(--px-text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)]" type="button">
                <X aria-hidden size={19} />
              </button>
            </Dialog.Close>
          </div>
          <div className="grid gap-2">
            {createOptions.map((option) => {
              const Icon = option.icon;
              return (
                <Dialog.Close asChild key={option.href}>
                  <Link
                    className="group flex min-h-20 items-center gap-3 rounded-2xl border border-[color:var(--px-border)] bg-[color:var(--px-surface)] p-3 text-left transition hover:border-[color:var(--px-primary)] hover:bg-[color:var(--px-primary-soft)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)]"
                    href={option.href}
                  >
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[color:var(--px-primary-soft)] text-[color:var(--px-primary)]">
                      <Icon aria-hidden size={21} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-black text-[color:var(--px-text)]">{option.label}</span>
                      <span className="mt-1 block text-xs leading-5 text-[color:var(--px-text-muted)]">{option.description}</span>
                    </span>
                    <ArrowRight aria-hidden className="shrink-0 text-[color:var(--px-primary)]" size={19} />
                  </Link>
                </Dialog.Close>
              );
            })}
          </div>
          <p className="mt-4 text-xs leading-5 text-[color:var(--px-text-muted)]">
            Community updates are available to members. Commercial listings may require trader approval.
          </p>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
