"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type FormEvent,
} from "react";
import {
  ArrowLeft,
  Check,
  CheckCheck,
  Clock3,
  Copy,
  Flag,
  Info,
  Loader2,
  MoreVertical,
  Pencil,
  Reply,
  Search,
  Send,
  ShieldCheck,
  X,
} from "lucide-react";
import Link from "next/link";
import {
  editMessageAction,
  markConversationReadAction,
  sendMessageAction,
} from "@/features/messages/actions";
import { blockUserAction } from "@/features/network/actions";

type ReplyPreview = {
  body: string;
  deletedAt?: string | null;
  id: string;
  senderId: string;
  senderName: string;
};

export type WorkspaceMessage = {
  body: string;
  createdAt: string;
  deletedAt?: string | null;
  editedAt?: string | null;
  id: string;
  readByOtherParticipants?: boolean;
  replyTo?: ReplyPreview | null;
  senderId: string;
  senderImageUrl?: string | null;
  senderName: string;
  status?: "sending" | "sent" | "failed";
};

export type WorkspaceConversation = {
  context?: string;
  dealHref?: string;
  id: string;
  lastMessage?: string;
  messages: WorkspaceMessage[];
  opportunityTitle?: string;
  participantId?: string | null;
  participantImageUrl?: string | null;
  participantName: string;
  participantPresence?: "hidden" | "online" | "recent" | "offline";
  participantRole?: string;
  participantUsername?: string;
  timestamp?: string;
  unreadCount?: number;
};

export function MessageWorkspace({
  backHref,
  conversations,
  currentUserId,
  defaultConversationId,
  highlightMessageId,
}: {
  backHref?: string;
  conversations: WorkspaceConversation[];
  currentUserId: string;
  defaultConversationId?: string;
  highlightMessageId?: string;
}) {
  const [activeId, setActiveId] = useState(defaultConversationId ?? conversations[0]?.id ?? "");
  const [mobileDetailOpen, setMobileDetailOpen] = useState(Boolean(defaultConversationId));
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [editDraft, setEditDraft] = useState("");
  const [editingMessageId, setEditingMessageId] = useState("");
  const [editError, setEditError] = useState("");
  const [sendError, setSendError] = useState("");
  const [replyTarget, setReplyTarget] = useState<WorkspaceMessage | null>(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState(highlightMessageId ?? "");
  const [syncedConversations, setSyncedConversations] = useState(() => conversations);
  const [localMessages, setLocalMessages] = useState<Record<string, WorkspaceMessage[]>>({});
  const [liveState, setLiveState] = useState<"connecting" | "live" | "reconnecting" | "fallback">("connecting");
  const [isPending, startTransition] = useTransition();
  const [isEditPending, startEditTransition] = useTransition();
  const historyRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    const node = listRef.current;
    if (!node) return;
    const key = "perx:messages:list-scroll";
    const saved = Number(window.sessionStorage.getItem(key) ?? 0);
    if (saved > 0) node.scrollTop = saved;

    const save = () => window.sessionStorage.setItem(key, String(node.scrollTop));
    node.addEventListener("scroll", save, { passive: true });
    return () => node.removeEventListener("scroll", save);
  }, []);

  useEffect(() => {
    let active = true;
    let eventSource: EventSource | null = null;
    let fallbackInterval: number | null = null;
    const updateConversations = (incoming: WorkspaceConversation[]) => {
      setSyncedConversations((current) => {
        if (!activeId) return incoming;
        const incomingById = new Map(
          incoming.map((conversation) => [conversation.id, conversation]),
        );
        const merged = current.map((conversation) => {
          const next = incomingById.get(conversation.id);
          if (!next || !highlightMessageId) return next ?? conversation;
          const target = conversation.messages.find(
            (message) => message.id === highlightMessageId,
          );
          if (!target || next.messages.some((message) => message.id === target.id)) {
            return next;
          }
          return {
            ...next,
            messages: [...next.messages, target].sort(
              (a, b) =>
                new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
            ),
          };
        });
        for (const conversation of incoming) {
          if (!current.some((candidate) => candidate.id === conversation.id)) {
            merged.push(conversation);
          }
        }
        return merged;
      });
    };
    const sync = async () => {
      try {
        const response = await fetch(
          activeId
            ? `/api/messages/sync?conversationId=${encodeURIComponent(activeId)}`
            : "/api/messages/sync",
          { cache: "no-store" },
        );
        if (!response.ok) return;
        const payload = (await response.json()) as {
          conversations?: WorkspaceConversation[];
        };
        if (active && payload.conversations) {
          updateConversations(payload.conversations);
        }
      } catch {
        // Polling is the fallback freshness path; persisted messages remain available after refresh.
      }
    };

    const startFallback = () => {
      if (fallbackInterval !== null) return;
      setLiveState((state) => (state === "live" ? "reconnecting" : "fallback"));
      void sync();
      fallbackInterval = window.setInterval(sync, 5000);
    };

    if (typeof EventSource === "undefined") {
      startFallback();
    } else {
      const url = activeId
        ? `/api/messages/events?conversationId=${encodeURIComponent(activeId)}`
        : "/api/messages/events";
      eventSource = new EventSource(url);
      eventSource.addEventListener("open", () => {
        if (!active) return;
        setLiveState("live");
        if (fallbackInterval !== null) {
          window.clearInterval(fallbackInterval);
          fallbackInterval = null;
        }
      });
      eventSource.addEventListener("conversations", (event) => {
        if (!active) return;
        const payload = JSON.parse((event as MessageEvent).data) as {
          conversations?: WorkspaceConversation[];
        };
        if (payload.conversations) {
          updateConversations(payload.conversations);
          setLiveState("live");
          window.dispatchEvent(new Event("perx-unread-refresh"));
        }
      });
      eventSource.addEventListener("stream-error", () => {
        if (!active) return;
        setLiveState("reconnecting");
        startFallback();
      });
      eventSource.addEventListener("unavailable", () => {
        if (!active) return;
        eventSource?.close();
        startFallback();
      });
      eventSource.onerror = () => {
        if (!active) return;
        setLiveState("reconnecting");
        startFallback();
      };
    }

    return () => {
      active = false;
      eventSource?.close();
      if (fallbackInterval !== null) window.clearInterval(fallbackInterval);
    };
  }, [activeId, highlightMessageId]);

  const activeConversation =
    syncedConversations.find((conversation) => conversation.id === activeId) ??
    syncedConversations[0];
  const messages = useMemo(() => {
    if (!activeConversation) return [];
    return [
      ...(activeConversation.messages ?? []),
      ...(localMessages[activeConversation.id] ?? []),
    ];
  }, [activeConversation, localMessages]);
  const latestMessageId = messages.at(-1)?.id;

  useEffect(() => {
    if (highlightedMessageId) return;
    historyRef.current?.scrollTo({
      behavior: "smooth",
      top: historyRef.current.scrollHeight,
    });
  }, [activeConversation?.id, highlightedMessageId, messages.length]);

  useEffect(() => {
    if (!highlightedMessageId) return;
    const target = messageRefs.current[highlightedMessageId];
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    const timeout = window.setTimeout(() => setHighlightedMessageId(""), 2200);
    return () => window.clearTimeout(timeout);
  }, [highlightedMessageId, messages.length]);

  useEffect(() => {
    if (!activeConversation?.id) return;
    void markConversationReadAction(activeConversation.id)
      .then((result) => {
        if (result.error) return;
        setSyncedConversations((current) =>
          current.map((conversation) =>
            conversation.id === activeConversation.id
              ? { ...conversation, unreadCount: 0 }
              : conversation,
          ),
        );
        window.dispatchEvent(new Event("perx-unread-refresh"));
      })
      .catch(() => {
        // The participant-scoped stream or polling fallback will retry freshness.
      });
  }, [activeConversation?.id, latestMessageId]);

  const sendMessage = (event?: FormEvent) => {
    event?.preventDefault();
    if (!draft.trim() || !activeConversation || isPending) return;

    const body = draft.trim();
    const conversationId = activeConversation.id;
    const messageId = `local-${Date.now()}`;
    const localReply = replyTarget ? toReplyPreview(replyTarget) : null;
    setSendError("");

    const message: WorkspaceMessage = {
      body,
      createdAt: new Date().toISOString(),
      id: messageId,
      replyTo: localReply,
      senderId: currentUserId,
      senderName: "You",
      status: "sending",
    };

    setLocalMessages((value) => ({
      ...value,
      [conversationId]: [...(value[conversationId] ?? []), message],
    }));
    setDraft("");
    setReplyTarget(null);

    startTransition(async () => {
      const result = await sendMessageAction(conversationId, body, localReply?.id ?? null);
      if (result.error) {
        setLocalMessages((value) => ({
          ...value,
          [conversationId]: (value[conversationId] ?? []).filter((m) => m.id !== messageId),
        }));
        setDraft(body);
        setReplyTarget(replyTarget);
        setSendError(result.error);
      } else {
        setLocalMessages((value) => ({
          ...value,
          [conversationId]: (value[conversationId] ?? []).filter((m) => m.id !== messageId),
        }));
        window.dispatchEvent(new Event("perx-unread-refresh"));
      }
    });
  };

  const startEditing = (message: WorkspaceMessage) => {
    setEditingMessageId(message.id);
    setEditDraft(message.body);
    setEditError("");
  };

  const cancelEditing = () => {
    setEditingMessageId("");
    setEditDraft("");
    setEditError("");
  };

  const saveEdit = (message: WorkspaceMessage) => {
    if (!editDraft.trim() || isEditPending) return;
    startEditTransition(async () => {
      const result = await editMessageAction(message.id, editDraft);
      if (result.error) {
        setEditError(result.error);
        return;
      }
      cancelEditing();
    });
  };

  const jumpToMessage = (messageId: string) => {
    setHighlightedMessageId(messageId);
    const target = messageRefs.current[messageId];
    if (!target) {
      setSendError("Original message is outside the loaded history. Refresh the conversation to load more context.");
    }
  };

  if (!syncedConversations.length) {
    return (
      <section className="grid min-h-[58dvh] place-items-center rounded-[24px] bg-[color:var(--px-surface)] p-8 text-center shadow-sm ring-1 ring-[color:var(--px-border)]">
        <div className="max-w-md">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[color:var(--px-primary-soft)] text-[color:var(--px-primary)]">
            <ShieldCheck size={24} />
          </div>
          <h1 className="mt-5 text-2xl font-black text-[color:var(--px-text)]">No conversations yet</h1>
          <p className="mt-3 text-sm leading-6 text-[color:var(--px-text-muted)]">
            Conversations open after accepted connections or approved opportunity workflows.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="relative grid h-[min(760px,calc(100dvh-5.5rem))] min-h-[540px] max-w-full overflow-hidden rounded-[24px] bg-[color:var(--px-surface)] shadow-[var(--px-shadow)] ring-1 ring-[color:var(--px-border)] lg:grid-cols-[320px_minmax(0,1fr)] 2xl:grid-cols-[320px_minmax(0,1fr)_320px]">
      <aside className={`${mobileDetailOpen ? "hidden lg:flex" : "flex"} min-h-0 flex-col border-r border-[color:var(--px-border)] bg-[color:var(--px-surface)]`}>
        <div className="border-b border-[color:var(--px-border)] p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-xl font-black text-[color:var(--px-text)]">Messages</h1>
              <p className="truncate text-xs text-[color:var(--px-text-muted)]">Private chats with connected PerX members.</p>
            </div>
            <span
              className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${
                liveState === "live"
                  ? "bg-green-50 text-green-800"
                  : "bg-amber-50 text-amber-900"
              }`}
            >
              {liveState === "live"
                ? "Live"
                : liveState === "connecting"
                  ? "Connecting"
                  : "Reconnecting"}
            </span>
            {backHref ? (
              <Link
                className="rounded-full border border-[color:var(--px-border)] px-3 py-1.5 text-xs font-bold text-[color:var(--px-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)]"
                href={backHref}
              >
                Back
              </Link>
            ) : null}
          </div>
          <label className="mt-4 flex h-11 items-center gap-2 rounded-[var(--px-radius-sm)] border border-[color:var(--px-border)] bg-[color:var(--px-muted)] px-3">
            <Search size={17} className="text-[color:var(--px-text-muted)]" />
            <span className="sr-only">Search conversations</span>
            <input
              className="min-w-0 flex-1 bg-transparent text-sm text-[color:var(--px-text)] outline-none placeholder:text-[color:var(--px-text-muted)]"
              placeholder="Search conversations..."
            />
          </label>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3" ref={listRef}>
          {syncedConversations.map((conversation) => {
            const active = conversation.id === activeConversation?.id;
            return (
              <button
                className={`flex w-full min-w-0 items-start gap-3 rounded-2xl p-3 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)] ${
                  active
                    ? "bg-[color:var(--px-primary-soft)] ring-1 ring-[color:var(--px-primary)]/25"
                    : "hover:bg-[color:var(--px-surface-soft)]"
                }`}
                key={conversation.id}
                onClick={() => {
                  setActiveId(conversation.id);
                  setMobileDetailOpen(true);
                }}
                type="button"
              >
                <Avatar
                  imageUrl={conversation.participantImageUrl}
                  name={conversation.participantName}
                  presence={conversation.participantPresence}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-bold text-[color:var(--px-text)]">{conversation.participantName}</p>
                    <span className="shrink-0 text-[10px] font-semibold text-[color:var(--px-text-muted)]">{formatConversationTime(conversation.timestamp)}</span>
                  </div>
                  <p className="truncate text-xs font-semibold text-[color:var(--px-primary)]">{conversation.opportunityTitle ?? conversation.context}</p>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-[color:var(--px-text-muted)]">{conversation.lastMessage ?? "No messages yet."}</p>
                </div>
                {conversation.unreadCount ? (
                  <span
                    aria-label={`${conversation.unreadCount} unread message${conversation.unreadCount === 1 ? "" : "s"}`}
                    className="grid h-5 min-w-5 place-items-center rounded-full bg-[color:var(--px-warning)] px-1.5 text-[10px] font-black text-white"
                  >
                    {conversation.unreadCount > 99 ? "99+" : conversation.unreadCount}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </aside>

      {activeConversation ? (
        <main className={`${mobileDetailOpen ? "flex" : "hidden lg:flex"} min-w-0 min-h-0 flex-col bg-[color:var(--px-page)]`}>
          <div className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-[color:var(--px-border)] bg-[color:var(--px-surface)] px-3 sm:px-4">
            <div className="flex min-w-0 items-center gap-3">
              <button
                aria-label="Back to conversations"
                className="grid h-10 w-10 place-items-center rounded-full text-[color:var(--px-text-muted)] hover:bg-[color:var(--px-surface-soft)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)] lg:hidden"
                onClick={() => setMobileDetailOpen(false)}
                type="button"
              >
                <ArrowLeft size={18} />
              </button>
              <button
                className="contents"
                onClick={() => setDetailsOpen(true)}
                type="button"
              >
                <Avatar
                  imageUrl={activeConversation.participantImageUrl}
                  name={activeConversation.participantName}
                  presence={activeConversation.participantPresence}
                />
              </button>
              <button
                className="min-w-0 text-left focus:outline-none focus-visible:rounded-md focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)]"
                onClick={() => setDetailsOpen(true)}
                type="button"
              >
                <h2 className="truncate text-sm font-black text-[color:var(--px-text)]">{activeConversation.participantName}</h2>
                <p className="truncate text-xs text-[color:var(--px-text-muted)]">
                  {presenceLabel(activeConversation.participantPresence) ??
                    activeConversation.participantRole ??
                    activeConversation.opportunityTitle ??
                    "PerX conversation"}
                </p>
              </button>
            </div>
            <button
              aria-label="Open conversation details"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-[color:var(--px-text-muted)] hover:bg-[color:var(--px-surface-soft)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)]"
              onClick={() => setDetailsOpen(true)}
              type="button"
            >
              <Info aria-hidden size={18} />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 sm:p-4" ref={historyRef}>
            <div className="mx-auto flex max-w-3xl flex-col gap-4">
              <div className="rounded-2xl border border-[color:var(--px-border)] bg-[color:var(--px-surface)] p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-[color:var(--px-primary)]">Safety reminder</p>
                <p className="mt-1 text-sm font-bold text-[color:var(--px-text)]">{activeConversation.opportunityTitle ?? activeConversation.context ?? "Professional conversation"}</p>
                <p className="mt-2 text-xs leading-5 text-[color:var(--px-text-muted)]">
                  Keep important conversations and agreements on PerX. This helps preserve records that may support dispute resolution, safety reviews and account protection.{" "}
                  <Link className="font-bold text-[color:var(--px-primary)] hover:underline" href="/trust-safety">
                    Trust & Safety
                  </Link>
                </p>
              </div>

              {messages.map((message) => (
                <MessageBubble
                  conversationId={activeConversation.id}
                  currentUserId={currentUserId}
                  editingMessageId={editingMessageId}
                  editDraft={editDraft}
                  editError={editError}
                  highlighted={highlightedMessageId === message.id}
                  isEditPending={isEditPending}
                  jumpToMessage={jumpToMessage}
                  key={message.id}
                  message={message}
                  onCancelEdit={cancelEditing}
                  onChangeEdit={setEditDraft}
                  onReply={() => setReplyTarget(message)}
                  onSaveEdit={saveEdit}
                  onStartEdit={startEditing}
                  refCallback={(node) => {
                    messageRefs.current[message.id] = node;
                  }}
                />
              ))}
            </div>
          </div>

          <form className="shrink-0 border-t border-[color:var(--px-border)] bg-[color:var(--px-surface)] p-3" onSubmit={sendMessage}>
            <div className="mx-auto grid max-w-3xl gap-2">
              {replyTarget ? (
                <div className="flex items-start justify-between gap-3 rounded-2xl border border-[color:var(--px-border)] bg-[color:var(--px-primary-soft)] p-3">
                  <div className="min-w-0 border-l-4 border-[color:var(--px-primary)] pl-3">
                    <p className="text-xs font-black text-[color:var(--px-primary)]">Replying to {replyTarget.senderName}</p>
                    <p className="mt-1 truncate text-sm text-[color:var(--px-text-muted)]">{messageExcerpt(replyTarget)}</p>
                  </div>
                  <button
                    aria-label="Cancel reply"
                    className="grid h-8 w-8 place-items-center rounded-full text-[color:var(--px-text-muted)] hover:bg-[color:var(--px-surface)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)]"
                    onClick={() => setReplyTarget(null)}
                    type="button"
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : null}
              <div className="flex items-end gap-2 rounded-2xl border border-[color:var(--px-border)] bg-[color:var(--px-muted)] p-2">
                <label className="sr-only" htmlFor="message-draft">Message</label>
                <textarea
                  className="max-h-36 min-h-11 flex-1 resize-none bg-transparent px-2 py-2 text-sm text-[color:var(--px-text)] outline-none placeholder:text-[color:var(--px-text-muted)]"
                  id="message-draft"
                  maxLength={2000}
                  onChange={(event) => setDraft(event.target.value)}
                  onInput={autoResize}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      sendMessage();
                    }
                  }}
                  placeholder="Type a message..."
                  rows={1}
                  value={draft}
                />
                <button
                  aria-label="Send message"
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[color:var(--px-primary)] text-white transition hover:bg-[color:var(--px-primary-strong)] disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)]"
                  disabled={!draft.trim() || isPending}
                  type="submit"
                >
                  {isPending ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
                </button>
              </div>
            </div>
            {sendError ? (
              <p className="mx-auto mt-2 max-w-3xl text-sm font-semibold text-[color:var(--px-error)]">
                {sendError}
              </p>
            ) : null}
          </form>
        </main>
      ) : null}

      <ConversationDetails
        conversation={activeConversation}
        onClose={() => setDetailsOpen(false)}
        open={detailsOpen}
      />
    </section>
  );
}

function MessageBubble({
  conversationId,
  currentUserId,
  editingMessageId,
  editDraft,
  editError,
  highlighted,
  isEditPending,
  jumpToMessage,
  message,
  onCancelEdit,
  onChangeEdit,
  onReply,
  onSaveEdit,
  onStartEdit,
  refCallback,
}: {
  conversationId: string;
  currentUserId: string;
  editingMessageId: string;
  editDraft: string;
  editError: string;
  highlighted: boolean;
  isEditPending: boolean;
  jumpToMessage: (messageId: string) => void;
  message: WorkspaceMessage;
  onCancelEdit: () => void;
  onChangeEdit: (value: string) => void;
  onReply: () => void;
  onSaveEdit: (message: WorkspaceMessage) => void;
  onStartEdit: (message: WorkspaceMessage) => void;
  refCallback: (node: HTMLDivElement | null) => void;
}) {
  const mine = message.senderId === currentUserId;
  const editing = editingMessageId === message.id;
  const isLocal = message.id.startsWith("local-");
  const canEdit = mine && !isLocal && !message.deletedAt;

  return (
    <div
      aria-current={highlighted ? "true" : undefined}
      className={`flex scroll-mt-24 ${mine ? "justify-end" : "justify-start"}`}
      data-message-id={message.id}
      ref={refCallback}
    >
      <div
        className={`group max-w-[min(82%,42rem)] overflow-visible rounded-3xl px-4 py-3 shadow-sm transition ${
          mine
            ? "rounded-br-md bg-[color:var(--px-primary)] text-white"
            : "rounded-bl-md bg-[color:var(--px-surface)] text-[color:var(--px-text)] ring-1 ring-[color:var(--px-border)]"
        } ${highlighted ? "ring-4 ring-[color:var(--px-warning)]" : ""}`}
      >
        <div className="mb-1 flex items-center justify-between gap-3">
          <p className={`truncate text-[10px] font-black uppercase tracking-wide ${mine ? "text-blue-100" : "text-[color:var(--px-primary)]"}`}>{message.senderName}</p>
          {!message.deletedAt ? (
            <MessageActionMenu
              canEdit={canEdit}
              conversationId={conversationId}
              mine={mine}
              message={message}
              onReply={onReply}
              onStartEdit={() => onStartEdit(message)}
            />
          ) : null}
        </div>

        {message.replyTo ? (
          <button
            className={`mb-2 block w-full rounded-2xl border-l-4 p-3 text-left focus:outline-none focus-visible:ring-2 ${
              mine
                ? "border-white/70 bg-white/10 focus-visible:ring-white"
                : "border-[color:var(--px-primary)] bg-[color:var(--px-muted)] focus-visible:ring-[color:var(--px-focus)]"
            }`}
            onClick={() => jumpToMessage(message.replyTo?.id ?? "")}
            type="button"
          >
            <p className={`text-xs font-black ${mine ? "text-white" : "text-[color:var(--px-primary)]"}`}>{message.replyTo.senderName}</p>
            <p className={`mt-1 line-clamp-2 text-xs leading-5 ${mine ? "text-blue-50" : "text-[color:var(--px-text-muted)]"}`}>{messageExcerpt(message.replyTo)}</p>
          </button>
        ) : null}

        {message.deletedAt ? (
          <p className="text-sm italic leading-6 opacity-80">This message was deleted.</p>
        ) : editing ? (
          <div className="grid gap-2">
            <label className="sr-only" htmlFor={`edit-${message.id}`}>
              Edit message
            </label>
            <textarea
              className="min-h-20 resize-none rounded-xl border border-[color:var(--px-border-strong)] bg-[color:var(--px-surface)] px-3 py-2 text-sm leading-6 text-[color:var(--px-text)] caret-[color:var(--px-primary)] outline-none placeholder:text-[color:var(--px-text-muted)] focus:ring-2 focus:ring-[color:var(--px-focus)]"
              id={`edit-${message.id}`}
              maxLength={2000}
              onChange={(event) => onChangeEdit(event.target.value)}
              onInput={autoResize}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  onCancelEdit();
                }
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  onSaveEdit(message);
                }
              }}
              rows={2}
              value={editDraft}
            />
            {editError ? (
              <p className="text-xs font-semibold text-[color:var(--px-error)]">{editError}</p>
            ) : null}
            <div className="flex justify-end gap-2">
              <button
                className="rounded-lg border border-[color:var(--px-border)] bg-[color:var(--px-surface)] px-3 py-1.5 text-xs font-bold text-[color:var(--px-text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)]"
                onClick={onCancelEdit}
                type="button"
              >
                Cancel
              </button>
              <button
                className="rounded-lg bg-[color:var(--px-primary)] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)]"
                disabled={!editDraft.trim() || isEditPending}
                onClick={() => onSaveEdit(message)}
                type="button"
              >
                {isEditPending ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        ) : (
          <p className="whitespace-pre-wrap break-words text-sm leading-6">{message.body}</p>
        )}
        <div className={`mt-2 flex items-center justify-end gap-1 text-[10px] ${mine ? "text-blue-100" : "text-[color:var(--px-text-muted)]"}`}>
          {message.editedAt ? <span>Edited</span> : null}
          <span>{formatMessageTime(message.createdAt)}</span>
          {mine ? <MessageStateIcon message={message} /> : null}
        </div>
      </div>
    </div>
  );
}

function MessageActionMenu({
  canEdit,
  conversationId,
  message,
  mine,
  onReply,
  onStartEdit,
}: {
  canEdit: boolean;
  conversationId: string;
  message: WorkspaceMessage;
  mine: boolean;
  onReply: () => void;
  onStartEdit: () => void;
}) {
  return (
    <details className="relative">
      <summary
        aria-label="Message actions"
        className={`grid h-7 w-7 list-none place-items-center rounded-full cursor-pointer focus:outline-none focus-visible:ring-2 ${
          mine
            ? "text-blue-100 hover:bg-white/10 focus-visible:ring-white"
            : "text-[color:var(--px-text-muted)] hover:bg-[color:var(--px-muted)] focus-visible:ring-[color:var(--px-focus)]"
        }`}
      >
        <MoreVertical aria-hidden size={15} />
      </summary>
      <div className="absolute right-0 z-30 mt-1 grid min-w-36 gap-1 rounded-xl border border-[color:var(--px-border)] bg-[color:var(--px-surface)] p-1 text-[color:var(--px-text)] shadow-lg">
        <button className="flex items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-bold hover:bg-[color:var(--px-muted)]" onClick={onReply} type="button">
          <Reply aria-hidden size={14} />
          Reply
        </button>
        {canEdit ? (
          <button className="flex items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-bold hover:bg-[color:var(--px-muted)]" onClick={onStartEdit} type="button">
            <Pencil aria-hidden size={14} />
            Edit
          </button>
        ) : null}
        <button
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-bold hover:bg-[color:var(--px-muted)]"
          onClick={() => void navigator.clipboard?.writeText(message.body)}
          type="button"
        >
          <Copy aria-hidden size={14} />
          Copy
        </button>
        {!message.id.startsWith("local-") ? (
          <Link
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-bold hover:bg-[color:var(--px-muted)]"
            href={`/app/reports/new?targetType=MESSAGE&targetId=${encodeURIComponent(
              message.id,
            )}&conversationId=${encodeURIComponent(
              conversationId,
            )}&messageId=${encodeURIComponent(message.id)}`}
          >
            <Flag aria-hidden size={14} />
            Report
          </Link>
        ) : null}
      </div>
    </details>
  );
}

function ConversationDetails({
  conversation,
  onClose,
  open,
}: {
  conversation?: WorkspaceConversation;
  onClose: () => void;
  open: boolean;
}) {
  if (!conversation) return null;

  const profileHref = conversation.participantUsername
    ? `/u/${conversation.participantUsername}`
    : null;

  const content = (
    <div className="flex min-h-0 flex-col gap-4 overflow-y-auto bg-[color:var(--px-surface)] p-4">
      <div className="flex items-center justify-between gap-3 2xl:hidden">
        <h3 className="font-black text-[color:var(--px-text)]">Details</h3>
        <button
          aria-label="Close conversation details"
          className="grid h-9 w-9 place-items-center rounded-full text-[color:var(--px-text-muted)] hover:bg-[color:var(--px-muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)]"
          onClick={onClose}
          type="button"
        >
          <X size={17} />
        </button>
      </div>

      <div className="rounded-3xl bg-[color:var(--px-surface-soft)] p-5 text-center ring-1 ring-[color:var(--px-border)]">
        <Avatar
          imageUrl={conversation.participantImageUrl}
          name={conversation.participantName}
          presence={conversation.participantPresence}
          size="lg"
        />
        <h3 className="mt-3 truncate font-black text-[color:var(--px-text)]">{conversation.participantName}</h3>
        <p className="truncate text-xs text-[color:var(--px-text-muted)]">@{conversation.participantUsername ?? "perx-member"}</p>
        <p className="mt-2 text-xs text-[color:var(--px-text-muted)]">{presenceLabel(conversation.participantPresence) ?? conversation.participantRole ?? "PerX member"}</p>
        {profileHref ? (
          <Link
            className="mt-4 inline-flex min-h-10 items-center rounded-[var(--px-radius-sm)] bg-[color:var(--px-primary)] px-4 text-sm font-bold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)]"
            href={profileHref}
          >
            View full profile
          </Link>
        ) : null}
        {conversation.participantId ? (
          <div className="mt-2 flex flex-col gap-2">
            <Link
              className="inline-flex min-h-10 items-center justify-center rounded-[var(--px-radius-sm)] border border-[color:var(--px-border-strong)] px-4 text-sm font-bold text-[color:var(--px-text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)]"
              href={`/app/reports/new?targetType=USER&targetId=${encodeURIComponent(
                conversation.participantId,
              )}`}
            >
              Report profile
            </Link>
            <form action={blockUserAction.bind(null, conversation.participantId)}>
              <button
                className="inline-flex min-h-10 w-full items-center justify-center rounded-[var(--px-radius-sm)] border border-red-200 px-4 text-sm font-bold text-red-700 transition hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                type="submit"
              >
                Block
              </button>
            </form>
          </div>
        ) : null}
      </div>

      <div className="rounded-3xl bg-[color:var(--px-surface-soft)] p-4 ring-1 ring-[color:var(--px-border)]">
        <h3 className="font-bold text-[color:var(--px-text)]">Deal</h3>
        <p className="mt-2 text-sm leading-6 text-[color:var(--px-text-muted)]">
          Deal workspaces are separate from chat. Real custody, transfers, and protected-funds actions are not active in beta.
        </p>
        {conversation.dealHref ? (
          <Link
            className="mt-3 inline-flex min-h-10 items-center rounded-[var(--px-radius-sm)] bg-[color:var(--px-primary)] px-4 text-sm font-bold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)]"
            href={conversation.dealHref}
          >
            Open deal
          </Link>
        ) : (
          <p className="mt-3 rounded-[var(--px-radius-sm)] bg-[color:var(--px-surface)] p-3 text-sm font-semibold text-[color:var(--px-text-muted)]">
            No deal is linked to this conversation.
          </p>
        )}
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden min-h-0 border-l border-[color:var(--px-border)] 2xl:flex">
        {content}
      </aside>
      {open ? (
        <div className="absolute inset-0 z-40 bg-black/30 2xl:hidden" role="presentation" onClick={onClose}>
          <aside
            aria-label="Conversation details"
            className="ml-auto h-full w-full max-w-sm overflow-hidden shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            {content}
          </aside>
        </div>
      ) : null}
    </>
  );
}

function Avatar({
  imageUrl,
  name,
  presence = "hidden",
  size = "md",
}: {
  imageUrl?: string | null;
  name: string;
  presence?: "hidden" | "online" | "recent" | "offline";
  size?: "md" | "lg";
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const dimensions = size === "lg" ? "mx-auto h-20 w-20 text-xl" : "h-11 w-11 text-sm";

  return (
    <div className="relative shrink-0">
      <div className={`${dimensions} grid overflow-hidden place-items-center rounded-full bg-[color:var(--px-primary)] font-black text-white ring-2 ring-[color:var(--px-surface)]`}>
        {imageUrl && !imageFailed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt={`${name} avatar`}
            className="h-full w-full object-cover"
            onError={() => setImageFailed(true)}
            src={imageUrl}
          />
        ) : (
          initials
        )}
      </div>
      {presence === "online" ? (
        <span
          aria-label="Online"
          className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full bg-green-500 ring-2 ring-[color:var(--px-surface)]"
          title="Online"
        />
      ) : presence === "recent" ? (
        <span
          aria-label="Recently active"
          className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full bg-amber-400 ring-2 ring-[color:var(--px-surface)]"
          title="Recently active"
        />
      ) : null}
    </div>
  );
}

function autoResize(event: FormEvent<HTMLTextAreaElement>) {
  const target = event.currentTarget;
  target.style.height = "auto";
  target.style.height = `${Math.min(target.scrollHeight, 160)}px`;
}

function toReplyPreview(message: WorkspaceMessage): ReplyPreview {
  return {
    body: message.body,
    deletedAt: message.deletedAt,
    id: message.id,
    senderId: message.senderId,
    senderName: message.senderName,
  };
}

function messageExcerpt(message: ReplyPreview | WorkspaceMessage) {
  if (message.deletedAt) return "Original message unavailable";
  const normalized = message.body.replace(/\s+/g, " ").trim();
  if (!normalized) return "Original message unavailable";
  return normalized.length > 96 ? `${normalized.slice(0, 96)}...` : normalized;
}

function presenceLabel(presence?: "hidden" | "online" | "recent" | "offline") {
  if (presence === "online") return "Online";
  if (presence === "recent") return "Recently active";
  return null;
}

function formatMessageTime(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatConversationTime(value?: string) {
  if (!value) return "new";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const thatDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayDiff = Math.round((today.getTime() - thatDay.getTime()) / 86_400_000);

  if (dayDiff === 0) return formatMessageTime(value);
  if (dayDiff === 1) return "Yesterday";
  return new Intl.DateTimeFormat(undefined, { day: "2-digit", month: "short" }).format(date);
}

function MessageStateIcon({ message }: { message: WorkspaceMessage }) {
  if (message.status === "sending") {
    return <Clock3 aria-label="Sending" size={13} />;
  }
  if (message.status === "failed") {
    return <span aria-label="Failed">Failed</span>;
  }
  if (message.readByOtherParticipants) {
    return <CheckCheck aria-label="Read" className="text-green-200" size={14} />;
  }
  return <Check aria-label="Sent" size={13} />;
}
