"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Handshake, Loader2, X } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";

import { Field, Input, Textarea } from "@/components/ui/form";
import {
  DEFAULT_CHAT_DEAL_DRAFT,
  clearChatDealDraft,
  hasChatDealDraft,
  readChatDealDraft,
  saveChatDealDraft,
  type ChatDealDraft,
} from "@/lib/messages/deal-draft";
import {
  submitConversationProposalAction,
  type ConversationProposalResult,
} from "@/features/proposals/actions";

export function ConversationDealOfferDialog({
  conversationId,
  currentUserId,
  currency,
  onOpenChange,
  onSubmitted,
  open,
  opportunityTitle,
  participantName,
}: {
  conversationId: string;
  currentUserId: string;
  currency: string;
  onOpenChange: (open: boolean) => void;
  onSubmitted: (
    event: Extract<ConversationProposalResult, { success: true }>["event"],
  ) => void;
  open: boolean;
  opportunityTitle: string;
  participantName: string;
}) {
  const [error, setError] = useState("");
  const [draft, setDraft] = useState<ChatDealDraft>({ ...DEFAULT_CHAT_DEAL_DRAFT });
  const [isPending, startTransition] = useTransition();
  const requestIdRef = useRef("");
  // Synchronous lock closes the gap before React paints the pending state.
  // The server also verifies the clientRequestId for idempotency.
  const submissionLockRef = useRef(false);

  useEffect(() => {
    // Defer browser-only session storage until hydration so SSR and client
    // start with identical default markup.
    const timer = window.setTimeout(() => {
      setDraft(readChatDealDraft(currentUserId, conversationId));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [currentUserId, conversationId]);

  const changeDraft = (field: keyof ChatDealDraft, value: string) => {
    const updated = { ...draft, [field]: value };
    setDraft(updated);
    saveChatDealDraft(currentUserId, conversationId, updated);
    // If a failed submit committed remotely but its response was lost, a
    // modified set of terms MUST NOT reuse the previous idempotency key.
    if (!submissionLockRef.current) requestIdRef.current = "";
  };

  const discardDraft = () => {
    if (submissionLockRef.current) return;
    clearChatDealDraft(currentUserId, conversationId);
    setDraft({ ...DEFAULT_CHAT_DEAL_DRAFT });
    requestIdRef.current = "";
    setError("");
  };

  const closeDialog = () => {
    setError("");
    onOpenChange(false);
  };

  return (
    <Dialog.Root
      onOpenChange={(nextOpen) => {
        if (nextOpen) requestIdRef.current = crypto.randomUUID();
        else setError("");
        onOpenChange(nextOpen);
      }}
      open={open}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[90] bg-[color:var(--px-overlay)] backdrop-blur-[2px]" />
        <Dialog.Content className="fixed inset-x-0 bottom-0 z-[91] max-h-[92dvh] overflow-y-auto rounded-t-[28px] border border-[color:var(--px-border)] bg-[color:var(--px-surface)] p-5 shadow-[var(--px-shadow-strong)] focus:outline-none sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:max-h-[90dvh] sm:w-[min(38rem,calc(100vw-2rem))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[28px] sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[color:var(--px-primary-soft)] text-[color:var(--px-primary)]">
                <Handshake aria-hidden size={20} />
              </span>
              <div className="min-w-0">
                <Dialog.Title className="text-xl font-black text-[color:var(--px-text)]">
                  Make a Deal
                </Dialog.Title>
                <Dialog.Description className="mt-1 text-sm leading-6 text-[color:var(--px-text-muted)]">
                  Send locked terms to {participantName} for {opportunityTitle}.
                  A Deal is created only if the other participant accepts this
                  exact version.
                </Dialog.Description>
              </div>
            </div>
            <Dialog.Close asChild>
              <button
                aria-label="Close Make a Deal"
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-[color:var(--px-text-muted)] hover:bg-[color:var(--px-muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)]"
                type="button"
              >
                <X aria-hidden size={19} />
              </button>
            </Dialog.Close>
          </div>

          <form
            className="mt-5 grid gap-4"
            onSubmit={(submitEvent) => {
              submitEvent.preventDefault();
              if (isPending || submissionLockRef.current) return;
              submissionLockRef.current = true;
              const form = new FormData(submitEvent.currentTarget);
              setError("");
              startTransition(async () => {
                let result: ConversationProposalResult;
                try {
                  const clientRequestId =
                    requestIdRef.current || crypto.randomUUID();
                  requestIdRef.current = clientRequestId;
                  result = await submitConversationProposalAction({
                    amount: String(form.get("amount") ?? ""),
                    clientRequestId,
                    conversationId,
                    deliveryDays: Number(form.get("deliveryDays")),
                    description: String(form.get("description") ?? ""),
                    revisions: Number(form.get("revisions")),
                  });
                } catch {
                  result = {
                    error: "Unable to submit this proposal. Please try again.",
                  };
                }
                submissionLockRef.current = false;
                if ("error" in result) {
                  setError(result.error);
                  return;
                }
                // A newly opened proposal must get a fresh idempotency key;
                // retries of a failed submission keep the same key.
                requestIdRef.current = "";
                clearChatDealDraft(currentUserId, conversationId);
                setDraft({ ...DEFAULT_CHAT_DEAL_DRAFT });
                onSubmitted(result.event);
                closeDialog();
              });
            }}
          >
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label={`Agreement amount (${currency})`}>
                <Input
                  autoComplete="off"
                  disabled={isPending}
                  value={draft.amount}
                  onChange={(event) => changeDraft("amount", event.target.value)}
                  inputMode="decimal"
                  maxLength={24}
                  name="amount"
                  placeholder="250000"
                  required
                />
              </Field>
              <Field label="Delivery days">
                <Input
                  value={draft.deliveryDays}
                  onChange={(event) => changeDraft("deliveryDays", event.target.value)}
                  disabled={isPending}
                  inputMode="numeric"
                  max="365"
                  min="1"
                  name="deliveryDays"
                  required
                  type="number"
                />
              </Field>
              <Field label="Included revisions">
                <Input
                  value={draft.revisions}
                  onChange={(event) => changeDraft("revisions", event.target.value)}
                  disabled={isPending}
                  inputMode="numeric"
                  max="12"
                  min="0"
                  name="revisions"
                  required
                  type="number"
                />
              </Field>
            </div>
            <Field
              hint="Describe the deliverable, scope, and acceptance criteria."
              label="Proposal terms"
            >
              <Textarea
                value={draft.description}
                onChange={(event) => changeDraft("description", event.target.value)}
                disabled={isPending}
                maxLength={2000}
                minLength={40}
                name="description"
                required
                rows={7}
              />
            </Field>
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[color:var(--px-text-muted)]">
              <p role="status">
                {hasChatDealDraft(draft)
                  ? "Draft saved in this browser tab · not submitted"
                  : "Terms are sent only when you submit the proposal."}
              </p>
              {hasChatDealDraft(draft) ? (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={discardDraft}
                  className="min-h-10 rounded-lg border border-[color:var(--px-border-strong)] px-3 font-bold text-[color:var(--px-text)] hover:bg-[color:var(--px-muted)] disabled:opacity-50"
                >
                  Discard draft
                </button>
              ) : null}
            </div>
            <div className="rounded-2xl border border-amber-400/40 bg-amber-500/10 p-3 text-xs leading-5 text-amber-900 dark:text-amber-100">
              Payments are currently unavailable. This Deal records agreed terms
              but does not hold funds.
            </div>
            {error ? (
              <p
                className="text-sm font-semibold text-[color:var(--px-error)]"
                role="alert"
              >
                {error}
              </p>
            ) : null}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Dialog.Close asChild>
                <button
                  className="min-h-11 rounded-xl border border-[color:var(--px-border)] px-4 text-sm font-black text-[color:var(--px-text)] hover:bg-[color:var(--px-muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)]"
                  type="button"
                >
                  Cancel
                </button>
              </Dialog.Close>
              <button
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[color:var(--px-primary)] px-5 text-sm font-black text-white hover:bg-[color:var(--px-primary-strong)] disabled:cursor-wait disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)]"
                disabled={isPending}
                type="submit"
              >
                {isPending ? (
                  <Loader2 aria-hidden className="animate-spin" size={17} />
                ) : (
                  <Handshake aria-hidden size={17} />
                )}
                {isPending ? "Submitting..." : "Submit proposal"}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
