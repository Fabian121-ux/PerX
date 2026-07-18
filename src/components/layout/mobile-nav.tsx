"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import Link from "next/link";

import { BrandSymbol } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";

export function MobileNav({
  links,
}: {
  links: { href: string; label: string }[];
}) {
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <Button
          aria-label="Open navigation"
          className="md:hidden"
          variant="secondary"
        >
          <BrandSymbol className="h-5 w-8" decorative />
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-[color:var(--px-overlay)] md:hidden" />
        <Dialog.Content className="fixed left-4 right-4 top-20 z-50 rounded-[var(--px-radius)] border border-[color:var(--px-border)] bg-[color:var(--px-surface)] p-3 shadow-[var(--px-shadow-strong)] focus:outline-none md:hidden">
          <div className="mb-2 flex items-center justify-between px-1">
            <Dialog.Title className="text-sm font-black text-[color:var(--px-text)]">
              Navigation
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                aria-label="Close navigation"
                className="grid h-10 w-10 place-items-center rounded-full text-[color:var(--px-text-muted)] transition hover:bg-[color:var(--px-surface-soft)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)]"
                type="button"
              >
                <X aria-hidden size={18} />
              </button>
            </Dialog.Close>
          </div>
          <nav className="grid gap-1">
            {links.map((link) => (
              <Dialog.Close asChild key={link.href}>
                <Link
                  className="rounded-[var(--px-radius-sm)] px-3 py-2 text-sm font-semibold text-[color:var(--px-text-muted)] hover:bg-[color:var(--px-muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)]"
                  href={link.href}
                >
                  {link.label}
                </Link>
              </Dialog.Close>
            ))}
          </nav>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
