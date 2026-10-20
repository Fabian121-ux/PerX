"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Handshake, LockKeyhole, ScrollText, ShieldAlert, X } from "lucide-react";
import Link from "next/link";
import type { WorkspaceConversation } from "@/components/messages/message-workspace";
import { getChatDealListingsAction, linkChatDealListingAction, type ChatDealListing } from "@/features/proposals/conversation-listings";

/**
 * Deal room is a view of the existing immutable proposal and Deal events,
 * not a second unsynced chat or a payment wallet.
 */
export function ChatDealRoom({
  conversation,
  onCreateTerms,
  onRequestListing,
  onLinkedListing,
  onOpenChange,
  open,
}: {
  conversation: WorkspaceConversation;
  onCreateTerms: () => void;
  onRequestListing?: () => void;
  onLinkedListing?: (listing: ChatDealListing) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  const [listings, setListings] = useState<ChatDealListing[]>([]);
  const [listingsLoading, setListingsLoading] = useState(false);
  const [linkingId, setLinkingId] = useState<string | null>(null);
  const [listingsError, setListingsError] = useState("");
  const linkPending = useRef(false);

  useEffect(() => {
    if (!open || conversation.deal || conversation.dealOffer || !onLinkedListing) return;
    let cancelled = false;
    // Reload on each opening: publication and moderation status may change.
    // No cached eligibility is treated as authorization for linking.
    void (async () => {
      setListings([]);
      setListingsError("");
      setListingsLoading(true);
      try {
        const result = await getChatDealListingsAction(conversation.id);
        if (cancelled) return;
        if ("error" in result) setListingsError(result.error);
        else setListings(result.listings);
      } catch {
        if (!cancelled) setListingsError("Could not load available listings.");
      } finally {
        if (!cancelled) setListingsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, conversation.id, conversation.deal, conversation.dealOffer, onLinkedListing]);

  const chooseListing = async (listing: ChatDealListing) => {
    if (linkPending.current) return;
    linkPending.current = true;
    setLinkingId(listing.id);
    setListingsError("");
    try {
      const result = await linkChatDealListingAction({
        conversationId: conversation.id,
        opportunityId: listing.id,
      });
      if ("error" in result) {
        setListingsError(result.error);
        return;
      }
      onLinkedListing?.(result.listing);
    } catch {
      setListingsError("Unable to link this listing. Try again.");
    } finally {
      linkPending.current = false;
      setLinkingId(null);
    }
  };

  const records = (conversation.events ?? []).filter((e) =>
    e.type.startsWith("PROPOSAL_") || e.type.startsWith("DEAL_"),
  ).slice(-6).reverse();
  return (
    <Dialog.Root onOpenChange={onOpenChange} open={open}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[90] bg-[#061936]/75 backdrop-blur-[2px]" />
        <Dialog.Content
          aria-label="Deal room"
          className="fixed inset-x-0 bottom-0 z-[91] max-h-[88dvh] overflow-y-auto rounded-t-[28px] border border-[color:var(--px-border-strong)] bg-[color:var(--px-surface)] px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-5 text-[color:var(--px-text)] shadow-2xl outline-none sm:bottom-auto sm:left-1/2 sm:right-auto sm:top-1/2 sm:w-[min(34rem,calc(100vw-2rem))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[28px] sm:p-6"
        >
          <div className="flex items-start justify-between gap-3">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-amber-100 text-[#80550b] dark:bg-amber-500/20 dark:text-amber-200">
              <LockKeyhole aria-hidden size={24} />
            </span>
            <Dialog.Close asChild>
              <button aria-label="Close Deal room" className="grid h-11 w-11 place-items-center rounded-full text-[color:var(--px-text)] hover:bg-[color:var(--px-muted)]" type="button">
                <X aria-hidden size={19} />
              </button>
            </Dialog.Close>
          </div>
          <Dialog.Title className="mt-4 text-xl font-black">Deal room</Dialog.Title>
          <Dialog.Description className="mt-1 text-sm leading-6 text-[color:var(--px-text-muted)]">
            A workspace for your agreement with {conversation.participantName}. Create terms, lock a submitted version and review decisions.
          </Dialog.Description>

          <div className="mt-4 rounded-2xl border border-amber-300 bg-[#fff6df] p-3 text-sm font-semibold leading-6 text-[#624408] dark:border-amber-500/50 dark:bg-[#3c3019] dark:text-amber-100">
            <ShieldAlert className="mr-2 inline-block align-text-bottom" size={18} aria-hidden />
            Locking terms does not lock or hold money. Payments and real escrow are unavailable.
          </div>

          {conversation.deal ? (
            <div className="mt-4 rounded-2xl border border-[color:var(--px-border-strong)] bg-[color:var(--px-surface-soft)] p-4">
              <p className="text-xs font-black uppercase tracking-wider text-[color:var(--px-text-muted)]">Existing agreement</p>
              <h3 className="mt-1 font-black">{conversation.deal.title}</h3>
              <p className="mt-1 text-sm font-semibold text-[color:var(--px-text)]">
                {conversation.deal.status.replaceAll("_", " ")} · recorded agreement only
              </p>
              {conversation.dealHref ? (
                <Link className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[color:var(--px-primary)] px-4 text-sm font-black text-white" href={conversation.dealHref} onClick={() => onOpenChange(false)}>
                  <Handshake aria-hidden size={18} /> Open linked Deal workspace <ArrowUpRight aria-hidden size={16} />
                </Link>
              ) : null}
            </div>
          ) : null}

          {conversation.dealOffer ? (
            <button
              className="mt-4 flex min-h-14 w-full items-center justify-between gap-3 rounded-2xl bg-[#1958cb] p-4 text-left text-sm font-black text-white transition hover:bg-[#0d459f]"
              onClick={onCreateTerms}
              type="button"
            >
              <span className="flex items-center gap-2"><ScrollText aria-hidden size={19} /> Draft and submit locked terms</span>
              <ArrowUpRight aria-hidden size={18} />
            </button>
          ) : !conversation.deal ? (
            <div className="mt-4 rounded-2xl border border-[color:var(--px-border-strong)] bg-[color:var(--px-surface-soft)] p-4">
              <h3 className="text-sm font-black text-[color:var(--px-text)]">Start a Deal from this chat</h3>
              <p className="mt-2 text-sm leading-6 text-[color:var(--px-text-muted)]">
                You can start a Deal by choosing an approved, published listing from {conversation.participantName}. If they have not published one, ask them to share a listing. Terms remain locked only after submitting a real proposal.
              </p>
              {onLinkedListing ? (
                <div className="mt-3" aria-label="Eligible listings">
                  {listingsLoading ? (
                    <p className="text-sm text-[color:var(--px-text-muted)]" role="status">Finding approved listings…</p>
                  ) : listings.length ? (
                    <div className="grid gap-2">
                      <p className="text-xs font-black text-[color:var(--px-text-muted)]">Choose a listing to create real Deal terms</p>
                      {listings.map((listing) => (
                        <button
                          key={listing.id}
                          className="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border border-[color:var(--px-border-strong)] bg-[color:var(--px-surface)] px-3 text-left text-sm font-bold text-[color:var(--px-primary-ink)] hover:bg-[color:var(--px-muted)] disabled:opacity-60"
                          disabled={linkingId !== null}
                          onClick={() => void chooseListing(listing)}
                          type="button"
                        >
                          <span className="min-w-0 flex-1 break-words">{listing.title} <span className="text-xs font-medium text-[color:var(--px-text-muted)]">({listing.currency})</span></span>
                          <span className="shrink-0">{linkingId === listing.id ? "Linking…" : "Select"}</span>
                        </button>
                      ))}
                    </div>
                  ) : !listingsError ? (
                    <p className="text-sm text-[color:var(--px-text-muted)]">No approved listings from this member are available for this chat yet.</p>
                  ) : null}
                  {listingsError ? <p role="alert" className="mt-2 text-sm font-semibold text-[color:var(--px-error)]">{listingsError}</p> : null}
                </div>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                {onRequestListing ? (
                  <button
                    className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#1656c7] px-4 text-sm font-black text-white hover:bg-[#0f459e]"
                    type="button"
                    onClick={onRequestListing}
                  >
                    Ask for a listing
                  </button>
                ) : null}
                <Link href="/app/discover" onClick={() => onOpenChange(false)} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[color:var(--px-border-strong)] bg-[color:var(--px-surface)] px-4 text-sm font-bold text-[color:var(--px-primary-ink)]">
                  Browse listings
                </Link>
              </div>
              <p className="mt-3 text-xs font-medium text-[color:var(--px-text-muted)]">
                You can always open @deal here. Secure proposal submission starts when the listing is eligible.
              </p>
            </div>
          ) : null}

          <div className="mt-5">
            <h3 className="text-sm font-black text-[color:var(--px-text)]">Proposal and Deal history</h3>
            <p className="mt-1 text-xs leading-5 text-[color:var(--px-text-muted)]">
              Submitted versions are immutable. Changes require a new numbered revision; both participants must accept the same version.
            </p>
            {records.length ? (
              <ol className="mt-3 grid gap-2">
                {records.map((event) => (
                  <li key={event.id} className="rounded-xl border border-[color:var(--px-border)] bg-[color:var(--px-surface-soft)] p-3">
                    <p className="text-xs font-black text-[color:var(--px-text)]">{event.type.replaceAll("_", " ")}</p>
                    <p className="mt-1 text-xs text-[color:var(--px-text-muted)]">{event.actorName || "PtahX system record"}</p>
                    {event.dealHref || event.proposalHref ? (
                      <Link href={event.dealHref || event.proposalHref || "#"} onClick={() => onOpenChange(false)}
                        className="mt-2 inline-flex min-h-9 items-center gap-1 text-xs font-black text-[color:var(--px-primary-ink)] underline underline-offset-4">
                        {event.dealHref ? "Open Deal" : "Review locked proposal"} <ArrowUpRight aria-hidden size={14} />
                      </Link>
                    ) : null}
                  </li>
                ))}
              </ol>
            ) : <p className="mt-3 text-sm text-[color:var(--px-text-muted)]">No agreement records yet. Regular messages are separate from locked terms.</p>}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
