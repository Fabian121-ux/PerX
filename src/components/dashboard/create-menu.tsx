"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Plus } from "lucide-react";
import Link from "next/link";

import { createOptions } from "@/lib/navigation/create-options";

export function CreateMenu({ previewMode = false }: { previewMode?: boolean }) {
  const options = createOptions.filter((option) => !previewMode || option.commercial);

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          className="hidden items-center gap-2 rounded-[var(--px-radius-sm)] bg-[color:var(--px-primary)] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[color:var(--px-primary-strong)] sm:flex"
          aria-label="Create new"
          type="button"
        >
          <Plus aria-hidden size={18} />
          Create
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="z-[100] w-64 rounded-xl border border-[color:var(--px-border)] bg-[color:var(--px-surface)] p-1 shadow-lg animate-in fade-in-0 zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2"
          sideOffset={8}
          align="end"
        >
          {options.map((option) => {
            const Icon = option.icon;
            const href = previewMode
              ? option.href
                  .replace(/^\/app\/opportunities/, "/preview/opportunities")
                  .replace(/^\/app\/posts/, "/preview/posts")
              : option.href;

            return (
              <DropdownMenu.Item asChild key={option.href}>
                <Link
                  href={href}
                  className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-[color:var(--px-text)] outline-none transition-colors hover:bg-[color:var(--px-muted)] focus:bg-[color:var(--px-muted)]"
                >
                  <Icon aria-hidden size={16} className="shrink-0 text-[color:var(--px-primary)]" />
                  <span>{option.label}</span>
                </Link>
              </DropdownMenu.Item>
            );
          })}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
