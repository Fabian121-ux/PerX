"use client";

import { PenLine } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

/** Opens the dedicated social composer; opportunities retain their own creation flow. */
export function FeedComposerEntry({
  avatarUrl,
  name,
}: {
  avatarUrl: string | null;
  name: string;
}) {
  const firstName = name.split(" ")[0] || name;

  return (
    <div className="rounded-[22px] border border-[color:var(--px-border)] bg-[color:var(--px-surface)] p-3 shadow-sm sm:p-4">
      <div className="flex items-center gap-3">
        {avatarUrl ? (
          <Image
            alt=""
            className="h-11 w-11 shrink-0 rounded-full object-cover ring-1 ring-[color:var(--px-border)]"
            height={44}
            /* Above the fold on every Home load. */
            priority
            src={avatarUrl}
            width={44}
          />
        ) : (
          <span
            aria-hidden
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[color:var(--px-primary)] text-sm font-black text-white"
          >
            {getInitials(name)}
          </span>
        )}
        <Link
          className="flex min-h-11 min-w-0 flex-1 items-center rounded-full border border-[color:var(--px-border)] bg-[color:var(--px-muted)] px-4 text-left text-sm text-[color:var(--px-text-muted)] transition hover:border-[color:var(--px-primary)] hover:text-[color:var(--px-text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)]"
          href="/app/posts/new"
        >
          <span className="truncate">What&rsquo;s happening, {firstName}?</span>
        </Link>
      </div>

      <div className="mt-3 flex items-center gap-2 border-t border-[color:var(--px-border)] pt-3">
        <ComposerAction
          href="/app/posts/new"
          icon={<PenLine aria-hidden size={17} />}
          label="Write a post"
        />
      </div>
    </div>
  );
}

function ComposerAction({
  href,
  icon,
  label,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-[var(--px-radius-sm)] px-3 text-sm font-bold text-[color:var(--px-text-muted)] transition hover:bg-[color:var(--px-muted)] hover:text-[color:var(--px-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)]"
      href={href}
    >
      {icon}
      <span className="truncate">{label}</span>
    </Link>
  );
}

function getInitials(value: string) {
  return value
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
