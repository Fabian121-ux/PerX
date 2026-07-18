"use client";

import { useMemo, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { ArrowLeft, FileText, Paperclip, Phone, Search, Send, ShieldCheck, Video, Loader2 } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { FeatureStatusDialog } from "@/components/shared/feature-status-dialog";
import { sendMessageAction } from "@/features/messages/actions";

export type WorkspaceMessage = {
  body: string;
  createdAt: string;
  id: string;
  senderId: string;
  senderName: string;
};

export type WorkspaceConversation = {
  context?: string;
  dealHref?: string;
  id: string;
  lastMessage?: string;
  messages: WorkspaceMessage[];
  opportunityTitle?: string;
  participantName: string;
  participantRole?: string;
  participantUsername?: string;
  timestamp?: string;
  trustScore?: number;
  unreadCount?: number;
};

export function MessageWorkspace({
  backHref,
  conversations,
  currentUserId,
  defaultConversationId,
}: {
  backHref?: string;
  conversations: WorkspaceConversation[];
  currentUserId: string;
  defaultConversationId?: string;
}) {
  const [activeId, setActiveId] = useState(defaultConversationId ?? conversations[0]?.id ?? "");
  const [mobileDetailOpen, setMobileDetailOpen] = useState(Boolean(defaultConversationId));
  const [draft, setDraft] = useState("");
  const [localMessages, setLocalMessages] = useState<Record<string, WorkspaceMessage[]>>({});
  const [isPending, startTransition] = useTransition();

  const activeConversation = conversations.find((conversation) => conversation.id === activeId) ?? conversations[0];
  const messages = useMemo(() => {
    if (!activeConversation) return [];
    return [...(activeConversation.messages ?? []), ...(localMessages[activeConversation.id] ?? [])];
  }, [activeConversation, localMessages]);

  const sendMessage = (event: FormEvent) => {
    event.preventDefault();
    if (!draft.trim() || !activeConversation || isPending) return;

    const body = draft.trim();
    const conversationId = activeConversation.id;
    const messageId = `local-${Date.now()}`;

    const message: WorkspaceMessage = {
      body,
      createdAt: new Date().toISOString(),
      id: messageId,
      senderId: currentUserId,
      senderName: "You",
    };

    setLocalMessages((value) => ({
      ...value,
      [conversationId]: [...(value[conversationId] ?? []), message],
    }));
    setDraft("");

    startTransition(async () => {
      const result = await sendMessageAction(conversationId, body);
      if (result.error) {
        // Rollback optimistic update
        setLocalMessages((value) => ({
          ...value,
          [conversationId]: (value[conversationId] ?? []).filter((m) => m.id !== messageId),
        }));
        alert(result.error);
      }
    });
  };

  if (!conversations.length) {
    return (
      <section className="grid min-h-[58dvh] place-items-center rounded-[28px] bg-[color:var(--px-surface)] p-8 text-center shadow-sm ring-1 ring-[color:var(--px-border)]">
        <div className="max-w-md">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[color:var(--px-primary-soft)] text-[color:var(--px-primary)]">
            <ShieldCheck size={24} />
          </div>
          <h1 className="mt-5 text-2xl font-black text-[color:var(--px-text)]">No conversations yet</h1>
          <p className="mt-3 text-sm leading-6 text-[color:var(--px-text-muted)]">
            A conversation appears when an opportunity connection or proposal creates a shared workspace.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="grid h-[min(720px,calc(100dvh-6rem))] min-h-[520px] overflow-hidden rounded-[24px] bg-[color:var(--px-surface)] shadow-[var(--px-shadow)] ring-1 ring-[color:var(--px-border)] lg:grid-cols-[320px_minmax(0,1fr)_300px]">
      <aside className={`${mobileDetailOpen ? "hidden lg:flex" : "flex"} min-h-0 flex-col border-r border-[color:var(--px-border)] bg-[color:var(--px-surface)]`}>
        <div className="border-b border-[color:var(--px-border)] p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-black text-[color:var(--px-text)]">Messages</h1>
              <p className="text-xs text-[color:var(--px-text-muted)]">Communication only. Deal state lives in deals.</p>
            </div>
            {backHref ? (
              <Link className="rounded-full border border-[color:var(--px-border)] px-3 py-1.5 text-xs font-bold text-[color:var(--px-primary)]" href={backHref}>
                Back
              </Link>
            ) : null}
          </div>
          <label className="mt-4 flex h-11 items-center gap-2 rounded-[var(--px-radius-sm)] border border-[color:var(--px-border)] bg-[color:var(--px-muted)] px-3">
            <Search size={17} className="text-[color:var(--px-text-muted)]" />
            <span className="sr-only">Search conversations</span>
            <input className="min-w-0 flex-1 bg-transparent text-sm text-[color:var(--px-text)] outline-none placeholder:text-[color:var(--px-text-muted)]" placeholder="Search conversations..." />
          </label>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {conversations.map((conversation) => {
            const active = conversation.id === activeConversation?.id;
            return (
              <button
                className={`flex w-full items-start gap-3 rounded-2xl p-3 text-left transition ${
                  active ? "bg-[color:var(--px-primary-soft)] ring-1 ring-[color:var(--px-primary)]/25" : "hover:bg-[color:var(--px-surface-soft)]"
                }`}
                key={conversation.id}
                onClick={() => {
                  setActiveId(conversation.id);
                  setMobileDetailOpen(true);
                }}
                type="button"
              >
                <Avatar name={conversation.participantName} online />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-bold text-[color:var(--px-text)]">{conversation.participantName}</p>
                    <span className="shrink-0 text-[10px] font-semibold text-[color:var(--px-text-muted)]">{conversation.timestamp ?? "now"}</span>
                  </div>
                  <p className="truncate text-xs font-semibold text-[color:var(--px-primary)]">{conversation.opportunityTitle ?? conversation.context}</p>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-[color:var(--px-text-muted)]">{conversation.lastMessage ?? "No messages yet."}</p>
                </div>
                {conversation.unreadCount ? (
                  <span className="grid h-5 min-w-5 place-items-center rounded-full bg-[color:var(--px-warning)] px-1.5 text-[10px] font-black text-white">
                    {conversation.unreadCount}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </aside>

      {activeConversation ? (
        <div className={`${mobileDetailOpen ? "flex" : "hidden lg:flex"} min-h-0 flex-col bg-[color:var(--px-page)]`}>
          <div className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-[color:var(--px-border)] bg-[color:var(--px-surface)] px-4">
            <div className="flex min-w-0 items-center gap-3">
              <button className="grid h-10 w-10 place-items-center rounded-full text-[color:var(--px-text-muted)] hover:bg-[color:var(--px-surface-soft)] lg:hidden" onClick={() => setMobileDetailOpen(false)} type="button" aria-label="Back to conversations">
                <ArrowLeft size={18} />
              </button>
              <Avatar name={activeConversation.participantName} online />
              <div className="min-w-0">
                <h2 className="truncate text-sm font-black text-[color:var(--px-text)]">{activeConversation.participantName}</h2>
                <p className="truncate text-xs text-[color:var(--px-text-muted)]">{activeConversation.participantRole ?? activeConversation.opportunityTitle ?? "perX conversation"}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <FeatureStatusDialog featureName="Voice call">
                <button className="grid h-10 w-10 place-items-center rounded-full text-[color:var(--px-text-muted)] hover:bg-[color:var(--px-surface-soft)]" aria-label="Start call" type="button">
                  <Phone size={17} />
                </button>
              </FeatureStatusDialog>
              <FeatureStatusDialog featureName="Video call">
                <button className="grid h-10 w-10 place-items-center rounded-full text-[color:var(--px-text-muted)] hover:bg-[color:var(--px-surface-soft)]" aria-label="Start video" type="button">
                  <Video size={17} />
                </button>
              </FeatureStatusDialog>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <div className="mx-auto flex max-w-3xl flex-col gap-4">
              <div className="rounded-2xl border border-[color:var(--px-border)] bg-[color:var(--px-surface)] p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-[color:var(--px-primary)]">Context</p>
                <p className="mt-1 text-sm font-bold text-[color:var(--px-text)]">{activeConversation.opportunityTitle ?? activeConversation.context ?? "Professional opportunity conversation"}</p>
                <p className="mt-2 text-xs leading-5 text-[color:var(--px-text-muted)]">Messaging does not control money, escrow or release states. Use deal actions for transaction changes.</p>
              </div>

              {messages.map((message) => {
                const mine = message.senderId === currentUserId;
                return (
                  <div className={`flex ${mine ? "justify-end" : "justify-start"}`} key={message.id}>
                    <div className={`max-w-[82%] rounded-3xl px-4 py-3 shadow-sm ${mine ? "rounded-br-md bg-[color:var(--px-primary)] text-white" : "rounded-bl-md bg-[color:var(--px-surface)] text-[color:var(--px-text)] ring-1 ring-[color:var(--px-border)]"}`}>
                      <p className={`mb-1 text-[10px] font-black uppercase tracking-wide ${mine ? "text-blue-100" : "text-[color:var(--px-primary)]"}`}>{message.senderName}</p>
                      <p className="text-sm leading-6">{message.body}</p>
                      <p className={`mt-2 text-[10px] ${mine ? "text-blue-100" : "text-[color:var(--px-text-muted)]"}`}>
                        {new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <form className="shrink-0 border-t border-[color:var(--px-border)] bg-[color:var(--px-surface)] p-3" onSubmit={sendMessage}>
            <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-2xl border border-[color:var(--px-border)] bg-[color:var(--px-muted)] p-2">
              <FeatureStatusDialog featureName="Message attachments">
                <button className="grid h-10 w-10 place-items-center rounded-xl text-[color:var(--px-text-muted)] hover:bg-[color:var(--px-surface)]" aria-label="Attach file" type="button">
                  <Paperclip size={18} />
                </button>
              </FeatureStatusDialog>
              <label className="sr-only" htmlFor="message-draft">Message</label>
              <textarea
                className="max-h-32 min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-sm text-[color:var(--px-text)] outline-none placeholder:text-[color:var(--px-text-muted)]"
                id="message-draft"
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Type a message..."
                value={draft}
              />
              <button className="grid h-10 w-10 place-items-center rounded-xl bg-[color:var(--px-primary)] text-white transition hover:bg-[color:var(--px-primary-strong)] disabled:opacity-50" disabled={!draft.trim() || isPending} type="submit" aria-label="Send message">
                {isPending ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      <aside className="hidden min-h-0 flex-col gap-4 overflow-y-auto border-l border-[color:var(--px-border)] bg-[color:var(--px-surface)] p-4 lg:flex">
        {activeConversation ? (
          <>
            <div className="rounded-3xl bg-[color:var(--px-surface-soft)] p-5 text-center ring-1 ring-[color:var(--px-border)]">
              <Avatar name={activeConversation.participantName} size="lg" online />
              <h3 className="mt-3 font-black text-[color:var(--px-text)]">{activeConversation.participantName}</h3>
              <p className="text-xs text-[color:var(--px-text-muted)]">@{activeConversation.participantUsername ?? "perx-member"}</p>
              {activeConversation.trustScore ? <Badge className="mt-3 bg-green-50 text-green-800">Trust {activeConversation.trustScore}</Badge> : null}
            </div>

            <div className="rounded-3xl bg-[color:var(--px-surface-soft)] p-4 ring-1 ring-[color:var(--px-border)]">
              <h3 className="font-bold text-[color:var(--px-text)]">Deal tools</h3>
              <div className="mt-3 grid gap-2">
                <ToolButton icon={<FileText size={16} />} label="View proposal" />
                {activeConversation.dealHref ? (
                  <Link className="flex items-center gap-2 rounded-[var(--px-radius-sm)] bg-[color:var(--px-primary)] px-3 py-2 text-sm font-bold text-white" href={activeConversation.dealHref}>
                    <ShieldCheck size={16} />
                    Deal workspace
                  </Link>
                ) : (
                  <ToolButton icon={<ShieldCheck size={16} />} label="Deal workspace" />
                )}
              </div>
            </div>

            <div className="rounded-3xl bg-[color:var(--px-surface-soft)] p-4 ring-1 ring-[color:var(--px-border)]">
              <h3 className="font-bold text-[color:var(--px-text)]">Shared files</h3>
              <div className="mt-3 grid gap-2 text-xs text-[color:var(--px-text-muted)]">
                <p className="rounded-[var(--px-radius-sm)] bg-[color:var(--px-surface)] p-3">proposal-scope.pdf</p>
                <p className="rounded-[var(--px-radius-sm)] bg-[color:var(--px-surface)] p-3">milestone-outline.docx</p>
              </div>
            </div>
          </>
        ) : null}
      </aside>
    </section>
  );
}

function Avatar({ name, online, size = "md" }: { name: string; online?: boolean; size?: "md" | "lg" }) {
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const dimensions = size === "lg" ? "mx-auto h-20 w-20 text-xl" : "h-11 w-11 text-sm";

  return (
    <div className="relative shrink-0">
      <div className={`${dimensions} grid place-items-center rounded-full bg-[color:var(--px-primary)] font-black text-white ring-2 ring-[color:var(--px-surface)]`}>
        {initials}
      </div>
      {online ? <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-[color:var(--px-success)] ring-2 ring-[color:var(--px-surface)]" /> : null}
    </div>
  );
}

function ToolButton({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <FeatureStatusDialog featureName={label}>
      <button className="flex w-full items-center gap-2 rounded-[var(--px-radius-sm)] bg-[color:var(--px-surface)] px-3 py-2 text-left text-sm font-bold text-[color:var(--px-text)] hover:bg-[color:var(--px-hover)]" type="button">
        {icon}
        {label}
      </button>
    </FeatureStatusDialog>
  );
}
