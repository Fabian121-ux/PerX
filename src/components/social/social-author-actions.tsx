"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Ban, Ellipsis, Flag, Loader2, ShieldCheck, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { blockUserAction } from "@/features/network/actions";
import { useConfirm, useToast } from "@/components/ui/feedback-provider";
import { socialContentReportTarget, type SocialReportContentKind } from "@/lib/social/report-target";

/**
 * Works with the existing moderated USER reports and personal block records.
 * A social-post-specific report type does not yet exist: never misrepresent a
 * member report as an individual post report.
 */
export function SocialAuthorActions({
  authorId,
  authorName,
  username,
  onBlocked,
  reportContent,
}: {
  authorId: string;
  authorName: string;
  username: string;
  onBlocked?: (authorId: string) => void;
  reportContent?: { kind: SocialReportContentKind; id: string };
}) {
  const [isBlocking, setIsBlocking] = useState(false);
  const pendingRef = useRef(false);
  const confirm = useConfirm();
  const toast = useToast();
  const router = useRouter();

  const blockAuthor = async () => {
    if (pendingRef.current) return;
    const approved = await confirm({
      title: `Block ${authorName}?`,
      description:
        "This person will no longer be able to message or connect with you. Their posts will also disappear from your feed. You can unblock them later in Settings.",
      confirmLabel: "Block member",
      tone: "danger",
    });
    if (!approved || pendingRef.current) return;
    pendingRef.current = true;
    setIsBlocking(true);
    try {
      await blockUserAction(authorId);
      onBlocked?.(authorId);
      toast({ title: `${authorName} blocked`, description: "You can undo this under Settings → Blocked users.", tone: "success" });
      router.refresh();
    } catch {
      toast({ title: "Could not block this member", description: "Please try again. No changes were made to your feed.", tone: "error" });
    } finally {
      pendingRef.current = false;
      setIsBlocking(false);
    }
  };

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          aria-label={`More options for ${authorName}`}
          aria-busy={isBlocking || undefined}
          className="ml-auto grid h-11 w-11 shrink-0 place-items-center rounded-full text-[color:var(--px-text)] transition hover:bg-[color:var(--px-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)]"
          disabled={isBlocking}
          type="button"
        >
          {isBlocking ? <Loader2 aria-hidden className="animate-spin" size={20} /> : <Ellipsis aria-hidden size={21} />}
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          className="z-[110] min-w-56 rounded-2xl border border-[color:var(--px-border-strong)] bg-[color:var(--px-surface)] p-1.5 text-[color:var(--px-text)] shadow-2xl"
          sideOffset={6}
        >
          <DropdownMenu.Label className="px-3 py-2 text-xs font-black text-[color:var(--px-text-muted)]">
            Member and content options
          </DropdownMenu.Label>
          <DropdownMenu.Item asChild>
            <Link href={`/u/${encodeURIComponent(username)}`} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-3 text-sm font-semibold text-[color:var(--px-text)] outline-none hover:bg-[color:var(--px-muted)] focus:bg-[color:var(--px-muted)]">
              <UserRound aria-hidden size={18} /> View profile
            </Link>
          </DropdownMenu.Item>
          {reportContent ? (
            <DropdownMenu.Item asChild>
              <Link
                href={`/app/reports/new?targetType=OTHER_CONTENT&targetId=${encodeURIComponent(socialContentReportTarget(reportContent.kind, reportContent.id))}`}
                className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-3 text-sm font-semibold text-[color:var(--px-text)] outline-none hover:bg-[color:var(--px-muted)] focus:bg-[color:var(--px-muted)]"
              >
                <Flag aria-hidden size={18} />
                Report {reportContent.kind === "POST" ? "post" : "comment"}
              </Link>
            </DropdownMenu.Item>
          ) : null}
          <DropdownMenu.Item asChild>
            <Link href={`/app/reports/new?targetType=USER&targetId=${encodeURIComponent(authorId)}`} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-3 text-sm font-semibold text-[color:var(--px-text)] outline-none hover:bg-[color:var(--px-muted)] focus:bg-[color:var(--px-muted)]">
              <Flag aria-hidden size={18} /> Report member
            </Link>
          </DropdownMenu.Item>
          <DropdownMenu.Item
            className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-3 text-sm font-bold text-[#a52627] outline-none hover:bg-[#fff0ee] focus:bg-[#fff0ee] dark:text-red-300 dark:hover:bg-[#421c20] dark:focus:bg-[#421c20]"
            disabled={isBlocking}
            onSelect={() => void blockAuthor()}
          >
            <Ban aria-hidden size={18} /> Block member
          </DropdownMenu.Item>
          <DropdownMenu.Separator className="my-1 h-px bg-[color:var(--px-border)]" />
          <DropdownMenu.Item asChild>
            <Link href="/app/settings/blocked" className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-3 text-sm font-semibold text-[color:var(--px-primary-ink)] outline-none hover:bg-[color:var(--px-muted)] focus:bg-[color:var(--px-muted)]">
              <ShieldCheck aria-hidden size={18} /> Manage blocked users
            </Link>
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
