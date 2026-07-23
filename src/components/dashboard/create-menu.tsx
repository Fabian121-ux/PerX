"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  Plus,
  Briefcase,
  FileSignature,
  Handshake,
  FolderPlus,
  Rocket,
} from "lucide-react";
import Link from "next/link";


export function CreateMenu({ previewMode = false }: { previewMode?: boolean }) {
  const getHref = (href: string) =>
    previewMode
      ? href.replace("/app/opportunities", "/preview/opportunities")
      : href;

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          className="hidden items-center gap-2 rounded-[var(--px-radius-sm)] bg-[color:var(--px-primary)] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[color:var(--px-primary-strong)] sm:flex"
          aria-label="Create new"
        >
          <Plus size={18} />
          Create
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="z-[100] w-56 rounded-xl border border-[color:var(--px-border)] bg-[color:var(--px-surface)] p-1 shadow-lg animate-in fade-in-0 zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2"
          sideOffset={8}
          align="end"
        >
          <DropdownMenu.Item asChild>
            <Link
              href={getHref("/app/opportunities/new?type=FREELANCE_PROJECT")}
              className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-[color:var(--px-text)] outline-none transition-colors hover:bg-[color:var(--px-muted)] focus:bg-[color:var(--px-muted)] data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
            >
              <Briefcase
                size={16}
                className="text-[color:var(--px-text-muted)]"
              />
              Create opportunity
            </Link>
          </DropdownMenu.Item>

          <DropdownMenu.Item asChild>
            <Link
              href={getHref("/app/opportunities/new?type=SERVICE")}
              className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-[color:var(--px-text)] outline-none transition-colors hover:bg-[color:var(--px-muted)] focus:bg-[color:var(--px-muted)]"
            >
              <FileSignature
                size={16}
                className="text-[color:var(--px-text-muted)]"
              />
              Offer service
            </Link>
          </DropdownMenu.Item>

          <DropdownMenu.Item asChild>
            <Link
              href={getHref("/app/opportunities/new?type=PARTNERSHIP")}
              className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-[color:var(--px-text)] outline-none transition-colors hover:bg-[color:var(--px-muted)] focus:bg-[color:var(--px-muted)]"
            >
              <Handshake
                size={16}
                className="text-[color:var(--px-text-muted)]"
              />
              Find partner
            </Link>
          </DropdownMenu.Item>

          <DropdownMenu.Separator className="my-1 h-px bg-[color:var(--px-border)]" />

          <DropdownMenu.Item asChild>
            <Link
              href={getHref("/app/opportunities/new?type=PROPERTY&category=real-estate")}
              className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-[color:var(--px-text)] outline-none transition-colors hover:bg-[color:var(--px-muted)] focus:bg-[color:var(--px-muted)]"
            >
              <FolderPlus
                size={16}
                className="text-[color:var(--px-text-muted)]"
              />
              Create real-estate listing
            </Link>
          </DropdownMenu.Item>

          <DropdownMenu.Item asChild>
            <Link
              href={getHref("/app/opportunities/new?type=STARTUP&category=startups")}
              className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-[color:var(--px-text)] outline-none transition-colors hover:bg-[color:var(--px-muted)] focus:bg-[color:var(--px-muted)]"
            >
              <Rocket
                size={16}
                className="text-[color:var(--px-text-muted)]"
              />
              Create startup listing
            </Link>
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
