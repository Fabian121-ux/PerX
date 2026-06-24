"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";

export function MobileNav({ links }: { links: { href: string; label: string }[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden">
      <Button aria-label={open ? "Close navigation" : "Open navigation"} onClick={() => setOpen((value) => !value)} variant="secondary">
        {open ? <X aria-hidden size={18} /> : <Menu aria-hidden size={18} />}
      </Button>
      {open ? (
        <div className="absolute left-4 right-4 top-20 z-40 rounded-[var(--px-radius)] border border-[color:var(--px-border)] bg-white p-3 shadow-[var(--px-shadow-strong)]">
          <nav className="grid gap-1">
            {links.map((link) => (
              <Link className="rounded-[var(--px-radius-sm)] px-3 py-2 text-sm font-semibold text-[color:var(--px-text-muted)] hover:bg-[color:var(--px-muted)]" href={link.href} key={link.href}>
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      ) : null}
    </div>
  );
}
