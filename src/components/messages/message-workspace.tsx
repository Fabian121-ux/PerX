"use client";

import {
  Fragment,
  useCallback,
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
  Handshake,
  Info,
  Menu,
  Loader2,
  LockKeyhole,
  MoreVertical,
  Pencil,
  Reply,
  Search,
  Send,
  ShieldCheck,
  Trash2,
  UserRoundX,
  X,
} from "lucide-react";
import Link from "next/link";
import { FeatureDirectory } from "@/components/navigation/feature-directory";
import {
  deleteMessageAction,
  editMessageAction,
  markConversationReadAction,
  removeConversationForMeAction,
  sendMessageAction,
} from "@/features/messages/actions";
import { blockUserAction } from "@/features/network/actions";
import { shouldSubmitMessage } from "@/lib/messages/composer-keyboard";

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

export type WorkspaceConversationEvent = {
  actorName?: string | null;
  createdAt: string;
  dealHref?: string | null;
  id: string;
  proposalVersionId?: string | null;
  snapshot: Record<string, unknown>;
  type:
    | "PROPOSAL_SUBMITTED"
    | "PROPOSAL_OBJECTION_RAISED"
    | "PROPOSAL_REVISION_CREATED"
    | "PROPOSAL_REVISION_SUBMITTED"
    | "PROPOSAL_ACCEPTED"
    | "PROPOSAL_REJECTED"
    | "DEAL_CREATED"
    | "DEAL_STATUS_CHANGED"
    | "MILESTONE_SUBMITTED"
    | "MILESTONE_APPROVED"
    | "SIMULATED_RELEASE_RECORDED";
};

export type WorkspaceConversation = {
  context?: string;
  deal?: {
    amountMinor: string;
    currency: string;
    id: string;
    settlementMode?: "SIMULATED" | "PROVIDER_DISABLED";
    status: string;
    title: string;
    versionLabel?: string;
  };
  dealHref?: string;
  events?: WorkspaceConversationEvent[];
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
  highlightEventId,
  highlightMessageId,
  userRoles,
}: {
  backHref?: string;
  conversations: WorkspaceConversation[];
  currentUserId: string;
  defaultConversationId?: string;
  highlightEventId?: string;
  highlightMessageId?: string;
  userRoles?: readonly string[];
}) {
  const [activeId, setActiveId] = useState(
    defaultConversationId ?? conversations[0]?.id ?? "",
  );
  const [mobileDetailOpen, setMobileDetailOpen] = useState(
    Boolean(defaultConversationId),
  );
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [conversationQuery, setConversationQuery] = useState("");
  const [conversationFilter, setConversationFilter] = useState<
    "all" | "unread" | "deals"
  >("all");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [editDraft, setEditDraft] = useState("");
  const [editingMessageId, setEditingMessageId] = useState("");
  const [editError, setEditError] = useState("");
  const [sendError, setSendError] = useState("");
  const [replyTarget, setReplyTarget] = useState<WorkspaceMessage | null>(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState(
    highlightMessageId ?? highlightEventId ?? "",
  );
  const [syncedConversations, setSyncedConversations] = useState(
    () => conversations,
  );
  const [localMessages, setLocalMessages] = useState<
    Record<string, WorkspaceMessage[]>
  >({});
  const [liveState, setLiveState] = useState<
    "connecting" | "live" | "reconnecting" | "fallback"
  >("connecting");
  const [isPending, startTransition] = useTransition();
  const [isEditPending, startEditTransition] = useTransition();
  const [openActionMenuMessageId, setOpenActionMenuMessageId] =
    useState("");
  const actionMenuRef = useRef<HTMLDivElement>(null);
  const draftStorageKey = `perx:messages:${currentUserId}:drafts`;
  const filterStorageKey = `perx:messages:${currentUserId}:filter`;
  const listScrollStorageKey = `perx:messages:${currentUserId}:list-scroll`;
  const queryStorageKey = `perx:messages:${currentUserId}:query`;
  const conversationButtonRefs = useRef<
    Record<string, HTMLButtonElement | null>
  >({});
  const conversationHeaderRef = useRef<HTMLDivElement>(null);
  const historyRef = useRef<HTMLDivElement>(null);
  const inlineDetailHistoryRef = useRef(false);
  const isComposingRef = useRef(false);
  const listRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    const node = listRef.current;
    if (!node) return;
    const saved = Number(
      window.sessionStorage.getItem(listScrollStorageKey) ?? 0,
    );
    if (saved > 0) node.scrollTop = saved;

    const save = () =>
      window.sessionStorage.setItem(
        listScrollStorageKey,
        String(node.scrollTop),
      );
    node.addEventListener("scroll", save, { passive: true });
    return () => node.removeEventListener("scroll", save);
  }, [listScrollStorageKey]);

  useEffect(() => {
    let restoredDrafts: Record<string, string> = {};
    try {
      const storedDrafts = JSON.parse(
        window.sessionStorage.getItem(draftStorageKey) ?? "{}",
      ) as Record<string, unknown>;
      restoredDrafts = Object.fromEntries(
        Object.entries(storedDrafts).filter(
          (entry): entry is [string, string] =>
            typeof entry[1] === "string" && Boolean(entry[1]),
        ),
      );
    } catch {
      window.sessionStorage.removeItem(draftStorageKey);
    }
    const restoredQuery =
      window.sessionStorage.getItem(queryStorageKey)?.slice(0, 120) ?? "";
    const restoredFilter = window.sessionStorage.getItem(filterStorageKey);
    let active = true;
    window.queueMicrotask(() => {
      if (!active) return;
      setDrafts(restoredDrafts);
      setConversationQuery(restoredQuery);
      if (
        restoredFilter === "all" ||
        restoredFilter === "unread" ||
        restoredFilter === "deals"
      ) {
        setConversationFilter(restoredFilter);
      }
    });
    return () => {
      active = false;
    };
  }, [draftStorageKey, filterStorageKey, queryStorageKey]);

  useEffect(() => {
    const className = "perx-mobile-conversation-active";
    document.documentElement.classList.toggle(className, mobileDetailOpen);
    return () => document.documentElement.classList.remove(className);
  }, [mobileDetailOpen]);

  useEffect(() => {
    const handleGlobalClick = (event: MouseEvent) => {
      if (
        openActionMenuMessageId &&
        actionMenuRef.current &&
        !actionMenuRef.current.contains(event.target as Node)
      ) {
        setOpenActionMenuMessageId("");
      }
    };
    document.addEventListener("click", handleGlobalClick, true);
    return () =>
      document.removeEventListener("click", handleGlobalClick, true);
  }, [openActionMenuMessageId]);

  const toggleActionMenu = useCallback(
    (messageId: string) => {
      setOpenActionMenuMessageId((current) =>
        current === messageId ? "" : messageId,
      );
    },
    [],
  );

  const closeActionMenu = useCallback(() => {
    setOpenActionMenuMessageId("");
  }, []);

  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      const conversationId = (event.state as {
        perxMessagesConversationId?: unknown;
      } | null)?.perxMessagesConversationId;
      if (
        typeof conversationId === "string" &&
        syncedConversations.some(
          (conversation) => conversation.id === conversationId,
        )
      ) {
        inlineDetailHistoryRef.current = true;
        setActiveId(conversationId);
        setMobileDetailOpen(true);
        document.documentElement.classList.add(
          "perx-mobile-conversation-active",
        );
        window.requestAnimationFrame(() => conversationHeaderRef.current?.focus());
        return;
      }
      if (!inlineDetailHistoryRef.current && !mobileDetailOpen) return;
      inlineDetailHistoryRef.current = false;
      setMobileDetailOpen(false);
      window.requestAnimationFrame(() => {
        conversationButtonRefs.current[activeId]?.focus();
      });
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [activeId, mobileDetailOpen, syncedConversations]);

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
          if (!next || (!highlightMessageId && !highlightEventId)) {
            return next ?? conversation;
          }
          const target = conversation.messages.find(
            (message) => message.id === highlightMessageId,
          );
          const targetEvent = conversation.events?.find(
            (event) => event.id === highlightEventId,
          );
          const mergedMessages =
            target && !next.messages.some((message) => message.id === target.id)
              ? [...next.messages, target].sort(
                  (a, b) =>
                    new Date(a.createdAt).getTime() -
                    new Date(b.createdAt).getTime(),
                )
              : next.messages;
          const mergedEvents =
            targetEvent &&
            !next.events?.some((event) => event.id === targetEvent.id)
              ? [...(next.events ?? []), targetEvent].sort(
                  (a, b) =>
                    new Date(a.createdAt).getTime() -
                    new Date(b.createdAt).getTime(),
                )
              : next.events;
          if (
            mergedMessages === next.messages &&
            mergedEvents === next.events
          ) {
            return next;
          }
          return {
            ...next,
            events: mergedEvents,
            messages: mergedMessages,
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
        const incoming = parseConversationEnvelope(await response.json());
        if (active && incoming) {
          updateConversations(incoming);
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
        let incoming: WorkspaceConversation[] | null = null;
        try {
          incoming = parseConversationEnvelope(
            JSON.parse((event as MessageEvent).data),
          );
        } catch {
          return;
        }
        if (incoming) {
          updateConversations(incoming);
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
  }, [activeId, highlightEventId, highlightMessageId]);

  const activeConversation =
    syncedConversations.find((conversation) => conversation.id === activeId) ??
    syncedConversations[0];
  const draft = drafts[activeConversation?.id ?? activeId] ?? "";
  const visibleConversations = useMemo(() => {
    const query = conversationQuery.trim().toLocaleLowerCase();
    return syncedConversations.filter((conversation) => {
      if (conversationFilter === "unread" && !conversation.unreadCount)
        return false;
      if (conversationFilter === "deals" && !conversation.dealHref)
        return false;
      if (!query) return true;
      return [
        conversation.participantName,
        conversation.participantUsername,
        conversation.opportunityTitle,
        conversation.context,
        conversation.lastMessage,
      ].some((value) => value?.toLocaleLowerCase().includes(query));
    });
  }, [conversationFilter, conversationQuery, syncedConversations]);
  const messages = useMemo(() => {
    if (!activeConversation) return [];
    return [
      ...(activeConversation.messages ?? []),
      ...(localMessages[activeConversation.id] ?? []),
    ];
  }, [activeConversation, localMessages]);
  const timeline = useMemo(
    () =>
      [
        ...messages.map((message) => ({
          createdAt: message.createdAt,
          id: message.id,
          kind: "message" as const,
          message,
        })),
        ...(activeConversation?.events ?? []).map((conversationEvent) => ({
          conversationEvent,
          createdAt: conversationEvent.createdAt,
          id: conversationEvent.id,
          kind: "event" as const,
        })),
      ].sort((a, b) => {
        const timeDifference =
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        return timeDifference || a.id.localeCompare(b.id);
      }),
    [activeConversation?.events, messages],
  );
  const latestEntryId = timeline.at(-1)?.id;

  useEffect(() => {
    if (highlightedMessageId) return;
    historyRef.current?.scrollTo({
      behavior: "smooth",
      top: historyRef.current.scrollHeight,
    });
  }, [activeConversation?.id, highlightedMessageId, timeline.length]);

  useEffect(() => {
    if (!highlightedMessageId) return;
    const target = messageRefs.current[highlightedMessageId];
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    const timeout = window.setTimeout(() => setHighlightedMessageId(""), 2200);
    return () => window.clearTimeout(timeout);
  }, [highlightedMessageId, timeline.length]);

  useEffect(() => {
    if (!activeConversation?.id) return;
    let stopped = false;
    let retryTimer: number | null = null;
    let retryCount = 0;
    const markRead = async () => {
      try {
        const result = await markConversationReadAction(activeConversation.id);
        if (result.error) throw new Error(result.error);
        if (stopped) return;
        setSyncedConversations((current) =>
          current.map((conversation) =>
            conversation.id === activeConversation.id
              ? { ...conversation, unreadCount: 0 }
              : conversation,
          ),
        );
        window.dispatchEvent(new Event("perx-unread-refresh"));
      } catch {
        if (!stopped && retryCount < 3) {
          const retryDelay = 5000 * 2 ** retryCount;
          retryCount += 1;
          retryTimer = window.setTimeout(() => void markRead(), retryDelay);
        }
      }
    };
    void markRead();
    return () => {
      stopped = true;
      if (retryTimer !== null) window.clearTimeout(retryTimer);
    };
  }, [activeConversation?.id, latestEntryId]);

  const openMobileConversation = (conversationId: string) => {
    setOpenActionMenuMessageId("");
    const mobile =
      typeof window.matchMedia !== "function" ||
      window.matchMedia("(max-width: 1023px)").matches;
    if (mobile && !backHref && !mobileDetailOpen) {
      window.history.pushState(
        {
          ...window.history.state,
          perxMessagesConversationId: conversationId,
        },
        "",
        window.location.href,
      );
      inlineDetailHistoryRef.current = true;
    }
    setActiveId(conversationId);
    if (mobile) {
      document.documentElement.classList.add("perx-mobile-conversation-active");
      setMobileDetailOpen(true);
      window.requestAnimationFrame(() => conversationHeaderRef.current?.focus());
    }
  };

  const closeMobileConversation = () => {
    setOpenActionMenuMessageId("");
    if (inlineDetailHistoryRef.current) {
      inlineDetailHistoryRef.current = false;
      setMobileDetailOpen(false);
      window.history.back();
      window.requestAnimationFrame(() => {
        conversationButtonRefs.current[activeId]?.focus();
      });
      return;
    }
    setMobileDetailOpen(false);
  };

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
    setDrafts((value) => ({ ...value, [conversationId]: "" }));
    persistDraft(draftStorageKey, conversationId, "");
    setReplyTarget(null);

    startTransition(async () => {
      const result = await sendMessageAction(
        conversationId,
        body,
        localReply?.id ?? null,
      );
      if (result.error) {
        setLocalMessages((value) => ({
          ...value,
          [conversationId]: (value[conversationId] ?? []).filter(
            (m) => m.id !== messageId,
          ),
        }));
        setDrafts((value) => ({ ...value, [conversationId]: body }));
        persistDraft(draftStorageKey, conversationId, body);
        setReplyTarget(replyTarget);
        setSendError(result.error);
      } else {
        setLocalMessages((value) => ({
          ...value,
          [conversationId]: (value[conversationId] ?? []).filter(
            (m) => m.id !== messageId,
          ),
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
      setSendError(
        "Original message is outside the loaded history. Refresh the conversation to load more context.",
      );
    }
  };

  const deleteMessage = async (message: WorkspaceMessage) => {
    if (
      !window.confirm(
        "Remove this message from participant view? A tombstone remains, and the original content is retained for safety, reports, and audit history.",
      )
    ) {
      return;
    }
    const result = await deleteMessageAction(message.id);
    if (result.error) {
      setSendError(result.error);
      return;
    }
    const deletedAt = new Date().toISOString();
    setSyncedConversations((current) =>
      current.map((conversation) => ({
        ...conversation,
        messages: conversation.messages.map((candidate) =>
          candidate.id === message.id ? { ...candidate, deletedAt } : candidate,
        ),
      })),
    );
  };

  const removeConversation = async () => {
    if (!activeConversation) return;
    if (
      !window.confirm(
        "Remove this chat from your list? It remains available to other participants and may return after a new message.",
      )
    ) {
      return;
    }
    const result = await removeConversationForMeAction(activeConversation.id);
    if (result.error) {
      setSendError(result.error);
      return;
    }
    const remaining = syncedConversations.filter(
      (conversation) => conversation.id !== activeConversation.id,
    );
    setSyncedConversations(remaining);
    persistDraft(draftStorageKey, activeConversation.id, "");
    setActiveId(remaining[0]?.id ?? "");
    setDetailsOpen(false);
    if (inlineDetailHistoryRef.current) {
      inlineDetailHistoryRef.current = false;
      window.history.back();
    }
    setMobileDetailOpen(false);
  };

  if (!syncedConversations.length) {
    return (
      <section className="grid min-h-[58dvh] place-items-center rounded-[24px] bg-[color:var(--px-surface)] p-8 text-center shadow-sm ring-1 ring-[color:var(--px-border)]">
        <div className="max-w-md">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[color:var(--px-primary-soft)] text-[color:var(--px-primary)]">
            <ShieldCheck size={24} />
          </div>
          <h1 className="mt-5 text-2xl font-black text-[color:var(--px-text)]">
            No conversations yet
          </h1>
          <p className="mt-3 text-sm leading-6 text-[color:var(--px-text-muted)]">
            Conversations open after accepted connections or approved
            opportunity workflows.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section
      aria-label="Message workspace"
      className="message-workspace relative grid h-[calc(100dvh-9rem)] min-h-0 max-w-full overflow-hidden rounded-[18px] bg-[color:var(--px-surface)] shadow-[var(--px-shadow)] ring-1 ring-[color:var(--px-border)] sm:h-[min(780px,calc(100dvh-7rem))] sm:rounded-[24px] lg:grid-cols-[300px_minmax(0,1fr)] 2xl:grid-cols-[300px_minmax(0,1fr)_320px]"
      data-mobile-view={mobileDetailOpen ? "conversation" : "list"}
    >
      <aside
        aria-label="Conversation list"
        className={`${mobileDetailOpen ? "hidden lg:flex" : "flex"} min-h-0 flex-col border-r border-[color:var(--px-border)] bg-[color:var(--px-surface)]`}
      >
        <div className="border-b border-[color:var(--px-border)] bg-[linear-gradient(145deg,var(--px-navy),var(--px-navy-3))] p-4 text-white">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/55">
                PerX workspace
              </p>
              <h1 className="mt-1 text-xl font-black">Messages</h1>
              <p className="truncate text-xs text-white/65">
                Conversations, terms, and Deal records.
              </p>
            </div>
            <span
              className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${
                liveState === "live"
                  ? "bg-emerald-400/15 text-emerald-200 ring-1 ring-emerald-300/20"
                  : "bg-amber-300/15 text-amber-100 ring-1 ring-amber-200/20"
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
                className="rounded-full border border-white/20 px-3 py-1.5 text-xs font-bold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                href={backHref}
              >
                Back
              </Link>
            ) : null}
          </div>
          <label className="mt-4 flex h-11 items-center gap-2 rounded-xl border border-white/12 bg-white/8 px-3 focus-within:border-white/35 focus-within:ring-2 focus-within:ring-white/10">
            <Search size={17} className="text-white/60" />
            <span className="sr-only">Search conversations</span>
            <input
              className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/45"
                onChange={(event) => {
                  setConversationQuery(event.target.value);
                  window.sessionStorage.setItem(
                    queryStorageKey,
                    event.target.value,
                  );
                }}
              placeholder="Search people or conversations"
              type="search"
              value={conversationQuery}
            />
          </label>
          <div
            aria-label="Conversation filters"
            className="mt-3 flex gap-1.5"
            role="group"
          >
            {(["all", "unread", "deals"] as const).map((filter) => (
              <button
                aria-pressed={conversationFilter === filter}
                className={`rounded-lg px-3 py-1.5 text-[11px] font-black capitalize transition focus:outline-none focus-visible:ring-2 focus-visible:ring-white ${
                  conversationFilter === filter
                    ? "bg-white text-[color:var(--px-navy)]"
                    : "bg-white/8 text-white/70 hover:bg-white/14 hover:text-white"
                }`}
                key={filter}
                onClick={() => {
                  setConversationFilter(filter);
                  window.sessionStorage.setItem(filterStorageKey, filter);
                }}
                type="button"
              >
                {filter}
              </button>
            ))}
          </div>
        </div>

        <div
          className="min-h-0 flex-1 overflow-y-auto p-3"
          data-conversation-list-scroll="true"
          ref={listRef}
        >
          {visibleConversations.map((conversation) => {
            const active = conversation.id === activeConversation?.id;
            return (
              <button
                className={`flex w-full min-w-0 items-start gap-3 rounded-2xl p-3 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)] ${
                  active
                    ? "bg-[color:var(--px-primary-soft)] ring-1 ring-[color:var(--px-primary)]/25"
                    : "hover:bg-[color:var(--px-surface-soft)]"
                }`}
                key={conversation.id}
                onClick={() => openMobileConversation(conversation.id)}
                ref={(node) => {
                  conversationButtonRefs.current[conversation.id] = node;
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
                    <p className="truncate text-sm font-bold text-[color:var(--px-text)]">
                      {conversation.participantName}
                    </p>
                    <span className="shrink-0 text-[10px] font-semibold text-[color:var(--px-text-muted)]">
                      {formatConversationTime(conversation.timestamp)}
                    </span>
                  </div>
                  <p className="truncate text-xs font-semibold text-[color:var(--px-primary)]">
                    {conversation.opportunityTitle ?? conversation.context}
                  </p>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-[color:var(--px-text-muted)]">
                    {drafts[conversation.id]?.trim() ? (
                      <>
                        <span className="font-black text-[color:var(--px-error)]">
                          Draft:{" "}
                        </span>
                        {drafts[conversation.id]}
                      </>
                    ) : (
                      (conversation.lastMessage ?? "No messages yet.")
                    )}
                  </p>
                </div>
                {conversation.unreadCount ? (
                  <span
                    aria-label={`${conversation.unreadCount} unread message${conversation.unreadCount === 1 ? "" : "s"}`}
                    className="grid h-5 min-w-5 place-items-center rounded-full bg-[color:var(--px-warning)] px-1.5 text-[10px] font-black text-white"
                  >
                    {conversation.unreadCount > 99
                      ? "99+"
                      : conversation.unreadCount}
                  </span>
                ) : null}
              </button>
            );
          })}
          {!visibleConversations.length ? (
            <div className="grid min-h-40 place-items-center rounded-2xl border border-dashed border-[color:var(--px-border-strong)] p-5 text-center">
              <div>
                <Search
                  className="mx-auto text-[color:var(--px-text-muted)]"
                  size={20}
                />
                <p className="mt-2 text-sm font-black text-[color:var(--px-text)]">
                  No conversations found
                </p>
                <p className="mt-1 text-xs leading-5 text-[color:var(--px-text-muted)]">
                  Try another search or filter.
                </p>
              </div>
            </div>
          ) : null}
        </div>
      </aside>

      {activeConversation ? (
        <section
          aria-label="Active conversation"
          className={`${mobileDetailOpen ? "flex" : "hidden lg:flex"} min-w-0 min-h-0 flex-col bg-[color:var(--px-page)]`}
        >
          <div
            className="message-conversation-header flex h-16 shrink-0 items-center justify-between gap-2 border-b border-[color:var(--px-border)] bg-[color:var(--px-surface)] px-2 outline-none sm:gap-3 sm:px-4"
            ref={conversationHeaderRef}
            tabIndex={-1}
          >
            <div className="flex min-w-0 flex-1 items-center gap-3">
              {backHref ? (
                <Link
                  aria-label="Back to conversations"
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-[color:var(--px-text-muted)] hover:bg-[color:var(--px-surface-soft)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)] lg:hidden"
                  href={backHref}
                >
                  <ArrowLeft aria-hidden size={19} />
                </Link>
              ) : (
                <button
                  aria-label="Back to conversations"
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-[color:var(--px-text-muted)] hover:bg-[color:var(--px-surface-soft)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)] lg:hidden"
                  onClick={closeMobileConversation}
                  type="button"
                >
                  <ArrowLeft aria-hidden size={19} />
                </button>
              )}
              <button
                aria-label={`Open details for ${activeConversation.participantName}`}
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
                className="min-w-0 overflow-hidden text-left focus:outline-none focus-visible:rounded-md focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)]"
                onClick={() => setDetailsOpen(true)}
                type="button"
              >
                <h2 className="truncate text-sm font-black text-[color:var(--px-text)]">
                  {activeConversation.participantName}
                </h2>
                <p className="truncate text-xs text-[color:var(--px-text-muted)]">
                  {presenceLabel(activeConversation.participantPresence) ??
                    activeConversation.participantRole ??
                    activeConversation.opportunityTitle ??
                    "PerX conversation"}
                </p>
              </button>
            </div>
            <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
              {userRoles !== undefined ? (
                <FeatureDirectory
                  closeLabel="Hide app navigation"
                  description="Move around PerX without leaving or reloading this conversation."
                  title="App navigation"
                  userRoles={userRoles}
                >
                  <button
                    aria-label="Show app navigation"
                    className="grid h-11 w-11 place-items-center rounded-full text-[color:var(--px-primary)] hover:bg-[color:var(--px-primary-soft)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)] lg:hidden"
                    type="button"
                  >
                    <Menu aria-hidden size={19} />
                  </button>
                </FeatureDirectory>
              ) : null}
              <button
                aria-label="Open conversation details"
                className="grid h-11 w-11 place-items-center rounded-full text-[color:var(--px-text-muted)] hover:bg-[color:var(--px-surface-soft)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)]"
                onClick={() => setDetailsOpen(true)}
                type="button"
              >
                <Info aria-hidden size={18} />
              </button>
            </div>
          </div>

          <div
            aria-label="Message history"
            className="bg-dot-pattern min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 sm:p-4"
            ref={historyRef}
          >
            <div className="mx-auto flex max-w-3xl flex-col gap-4">
              <div className="rounded-2xl border border-[color:var(--px-border)] bg-[color:var(--px-surface)] p-4">
                <div className="flex items-center gap-2 text-[color:var(--px-primary)]">
                  <LockKeyhole aria-hidden size={15} />
                  <p className="text-xs font-bold uppercase tracking-wide">
                    Keep a clear record
                  </p>
                </div>
                <p className="mt-1 text-sm font-bold text-[color:var(--px-text)]">
                  {activeConversation.opportunityTitle ??
                    activeConversation.context ??
                    "Professional conversation"}
                </p>
                <p className="mt-2 text-xs leading-5 text-[color:var(--px-text-muted)]">
                  Keep important conversations and agreements on PerX. This
                  helps preserve records that may support dispute resolution,
                  safety reviews and account protection.{" "}
                  <Link
                    className="font-bold text-[color:var(--px-primary)] hover:underline"
                    href="/trust-safety"
                  >
                    Trust & Safety
                  </Link>
                </p>
              </div>

              {activeConversation.deal ? (
                <DealSummaryCard
                  deal={activeConversation.deal}
                  href={activeConversation.dealHref}
                />
              ) : null}

              {timeline.map((entry, index) => (
                <Fragment key={`${entry.kind}:${entry.id}`}>
                  {shouldShowDateSeparator(
                    timeline[index - 1]?.createdAt,
                    entry.createdAt,
                  ) ? (
                    <DateSeparator value={entry.createdAt} />
                  ) : null}
                  {entry.kind === "message" ? (
                    <MessageBubble
                      conversationId={activeConversation.id}
                      currentUserId={currentUserId}
                      editingMessageId={editingMessageId}
                      editDraft={editDraft}
                      editError={editError}
                      highlighted={highlightedMessageId === entry.message.id}
                      isEditPending={isEditPending}
                      jumpToMessage={jumpToMessage}
                      message={entry.message}
                      onCancelEdit={cancelEditing}
                      onChangeEdit={setEditDraft}
                      onCloseActionMenu={closeActionMenu}
                      onDelete={() => void deleteMessage(entry.message)}
                      onReply={() => setReplyTarget(entry.message)}
                      onSaveEdit={saveEdit}
                      onStartEdit={startEditing}
                      onToggleActionMenu={toggleActionMenu}
                      openActionMenu={openActionMenuMessageId === entry.message.id}
                      refCallback={(node) => {
                        messageRefs.current[entry.message.id] = node;
                      }}
                    />
                  ) : (
                    <ConversationEventCard
                      event={entry.conversationEvent}
                      highlighted={
                        highlightedMessageId === entry.conversationEvent.id
                      }
                      refCallback={(node) => {
                        messageRefs.current[entry.conversationEvent.id] = node;
                      }}
                    />
                  )}
                </Fragment>
              ))}
            </div>
          </div>

          <form
            aria-label="Message composer"
            className="message-composer shrink-0 border-t border-[color:var(--px-border)] bg-[color:var(--px-surface)] p-3"
            onSubmit={sendMessage}
          >
            <div className="mx-auto grid max-w-3xl gap-2">
              {replyTarget ? (
                <div className="flex items-start justify-between gap-3 rounded-2xl border border-[color:var(--px-border)] bg-[color:var(--px-primary-soft)] p-3">
                  <div className="min-w-0 border-l-4 border-[color:var(--px-primary)] pl-3">
                    <p className="text-xs font-black text-[color:var(--px-primary)]">
                      Replying to {replyTarget.senderName}
                    </p>
                    <p className="mt-1 truncate text-sm text-[color:var(--px-text-muted)]">
                      {messageExcerpt(replyTarget)}
                    </p>
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
                <label className="sr-only" htmlFor="message-draft">
                  Message
                </label>
                <textarea
                  className="max-h-36 min-h-11 flex-1 resize-none bg-transparent px-2 py-2 text-sm text-[color:var(--px-text)] outline-none placeholder:text-[color:var(--px-text-muted)]"
                  id="message-draft"
                  maxLength={2000}
                  onChange={(event) => {
                    const conversationId = activeConversation.id;
                    const nextDraft = event.target.value;
                    setDrafts((value) => ({
                      ...value,
                      [conversationId]: nextDraft,
                    }));
                    persistDraft(draftStorageKey, conversationId, nextDraft);
                  }}
                  onCompositionEnd={() => {
                    isComposingRef.current = false;
                  }}
                  onCompositionStart={() => {
                    isComposingRef.current = true;
                  }}
                  onInput={autoResize}
                  onKeyDown={(event) => {
                    if (
                      shouldSubmitMessage({
                        ctrlKey: event.ctrlKey,
                        isComposing:
                          isComposingRef.current ||
                          event.nativeEvent.isComposing,
                        key: event.key,
                        keyCode: event.keyCode,
                        metaKey: event.metaKey,
                      })
                    ) {
                      event.preventDefault();
                      event.currentTarget.form?.requestSubmit();
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
                  {isPending ? (
                    <Loader2 className="animate-spin" size={18} />
                  ) : (
                    <Send size={18} />
                  )}
                </button>
              </div>
              <p className="px-1 text-[10px] font-semibold text-[color:var(--px-text-muted)]">
                Enter adds a new line. Ctrl+Enter or Command+Enter sends.
              </p>
            </div>
            {sendError ? (
              <p className="mx-auto mt-2 max-w-3xl text-sm font-semibold text-[color:var(--px-error)]">
                {sendError}
              </p>
            ) : null}
          </form>
        </section>
      ) : null}

      <ConversationDetails
        conversation={activeConversation}
        onClose={() => setDetailsOpen(false)}
        onRemove={() => void removeConversation()}
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
  onCloseActionMenu,
  onDelete,
  onReply,
  onSaveEdit,
  onStartEdit,
  onToggleActionMenu,
  openActionMenu,
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
  onCloseActionMenu: () => void;
  onDelete: () => void;
  onReply: () => void;
  onSaveEdit: (message: WorkspaceMessage) => void;
  onStartEdit: (message: WorkspaceMessage) => void;
  onToggleActionMenu: (messageId: string) => void;
  openActionMenu: boolean;
  refCallback: (node: HTMLDivElement | null) => void;
}) {
  const mine = message.senderId === currentUserId;
  const editing = editingMessageId === message.id;
  const isLocal = message.id.startsWith("local-");
  const canEdit = mine && !isLocal && !message.deletedAt;
  const editIsComposingRef = useRef(false);
  const longPressTimerRef = useRef<number | null>(null);
  const longPressStartRef = useRef<{ x: number; y: number } | null>(null);
  const swipeStartRef = useRef<{ x: number; y: number; time: number } | null>(
    null,
  );
  const [swipeOffset, setSwipeOffset] = useState(0);

  const handleTouchStart = useCallback(
    (event: React.TouchEvent) => {
      const touch = event.touches[0];
      if (!touch) return;
      if (
        (event.target as HTMLElement).closest(
          "a, button, [role=button], input, textarea, select, summary",
        )
      )
        return;
      longPressStartRef.current = { x: touch.clientX, y: touch.clientY };
      longPressTimerRef.current = window.setTimeout(() => {
        longPressTimerRef.current = null;
        onToggleActionMenu(message.id);
      }, 500);
      swipeStartRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        time: Date.now(),
      };
    },
    [message.id, onToggleActionMenu],
  );

  const handleTouchMove = useCallback(
    (event: React.TouchEvent) => {
      const touch = event.touches[0];
      if (!touch) return;
      if (longPressTimerRef.current && longPressStartRef.current) {
        const dx = Math.abs(touch.clientX - longPressStartRef.current.x);
        const dy = Math.abs(touch.clientY - longPressStartRef.current.y);
        if (dx > 10 || dy > 10) {
          window.clearTimeout(longPressTimerRef.current);
          longPressTimerRef.current = null;
        }
      }
      if (swipeStartRef.current && !mine) {
        const dx = touch.clientX - swipeStartRef.current.x;
        const dy = Math.abs(touch.clientY - swipeStartRef.current.y);
        if (dx > 10 && dx > dy * 1.5) {
          setSwipeOffset(Math.min(dx, 100));
        }
      }
    },
    [mine],
  );

  const handleTouchEnd = useCallback(() => {
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    longPressStartRef.current = null;
    if (swipeOffset >= 70 && !mine) {
      onReply();
    }
    setSwipeOffset(0);
    swipeStartRef.current = null;
  }, [swipeOffset, mine, onReply]);

  const handleContextMenu = useCallback(
    (event: React.MouseEvent) => {
      if (openActionMenu) return;
      event.preventDefault();
      onToggleActionMenu(message.id);
    },
    [message.id, onToggleActionMenu, openActionMenu],
  );

  return (
    <div
      aria-current={highlighted ? "true" : undefined}
      className={`flex scroll-mt-24 ${mine ? "justify-end" : "justify-start"}`}
      data-message-id={message.id}
      onContextMenu={handleContextMenu}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchMove}
      onTouchStart={handleTouchStart}
      ref={refCallback}
    >
      <div
        className={`group max-w-[min(82%,42rem)] overflow-visible rounded-3xl px-4 py-3 shadow-sm transition ${
          swipeOffset > 0 ? "relative" : ""
        } ${
          mine
            ? "rounded-br-md bg-[linear-gradient(135deg,var(--px-primary),var(--px-secondary))] text-white"
            : "rounded-bl-md bg-[color:var(--px-surface)] text-[color:var(--px-text)] ring-1 ring-[color:var(--px-border)]"
        } ${highlighted ? "ring-4 ring-[color:var(--px-warning)]" : ""}`}
      >
        <div className="mb-1 flex items-center justify-between gap-3">
          <p
            className={`truncate text-[10px] font-black uppercase tracking-wide ${mine ? "text-blue-100" : "text-[color:var(--px-primary)]"}`}
          >
            {message.senderName}
          </p>
          {!message.deletedAt ? (
            <div className="relative flex items-center gap-1">
              <div
                className={`hidden items-center gap-0.5 rounded-xl bg-[color:var(--px-surface-soft)] p-0.5 opacity-0 transition group-hover:opacity-100 sm:flex ${
                  mine ? "order-first" : "order-last"
                }`}
              >
                <button
                  aria-label="Reply"
                  className="grid h-8 w-8 place-items-center rounded-lg text-[color:var(--px-text-muted)] hover:bg-[color:var(--px-hover)] hover:text-[color:var(--px-text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)]"
                  type="button"
                  onClick={onReply}
                >
                  <Reply aria-hidden size={14} />
                </button>
                <button
                  aria-label="Copy"
                  className="grid h-8 w-8 place-items-center rounded-lg text-[color:var(--px-text-muted)] hover:bg-[color:var(--px-hover)] hover:text-[color:var(--px-text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)]"
                  type="button"
                  onClick={() =>
                    void navigator.clipboard?.writeText(message.body)
                  }
                >
                  <Copy aria-hidden size={14} />
                </button>
                {canEdit ? (
                  <button
                    aria-label="Edit"
                    className="grid h-8 w-8 place-items-center rounded-lg text-[color:var(--px-text-muted)] hover:bg-[color:var(--px-hover)] hover:text-[color:var(--px-text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)]"
                    type="button"
                    onClick={() => onStartEdit(message)}
                  >
                    <Pencil aria-hidden size={14} />
                  </button>
                ) : null}
                {canEdit ? (
                  <button
                    aria-label="Remove message"
                    className="grid h-8 w-8 place-items-center rounded-lg text-[color:var(--px-error)] hover:bg-red-50 dark:hover:bg-red-950/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)]"
                    type="button"
                    onClick={onDelete}
                  >
                    <Trash2 aria-hidden size={14} />
                  </button>
                ) : null}
              </div>
              <MessageActionMenu
                canEdit={canEdit}
                conversationId={conversationId}
                isOpen={openActionMenu}
                message={message}
                mine={mine}
                onClose={onCloseActionMenu}
                onDelete={onDelete}
                onReply={onReply}
                onStartEdit={() => onStartEdit(message)}
                onToggle={() => onToggleActionMenu(message.id)}
              />
            </div>
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
            <p
              className={`text-xs font-black ${mine ? "text-white" : "text-[color:var(--px-primary)]"}`}
            >
              {message.replyTo.senderName}
            </p>
            <p
              className={`mt-1 line-clamp-2 text-xs leading-5 ${mine ? "text-blue-50" : "text-[color:var(--px-text-muted)]"}`}
            >
              {messageExcerpt(message.replyTo)}
            </p>
          </button>
        ) : null}

        {message.deletedAt ? (
          <p className="text-sm italic leading-6 opacity-80">
            This message was removed from the chat view.
          </p>
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
              onCompositionEnd={() => {
                editIsComposingRef.current = false;
              }}
              onCompositionStart={() => {
                editIsComposingRef.current = true;
              }}
              onInput={autoResize}
              onKeyDown={(event) => {
                const composing =
                  editIsComposingRef.current ||
                  event.nativeEvent.isComposing ||
                  event.keyCode === 229;
                if (event.key === "Escape" && !composing) {
                  event.preventDefault();
                  onCancelEdit();
                }
                if (
                  shouldSubmitMessage({
                    ctrlKey: event.ctrlKey,
                    isComposing:
                      editIsComposingRef.current ||
                      event.nativeEvent.isComposing,
                    key: event.key,
                    keyCode: event.keyCode,
                    metaKey: event.metaKey,
                  })
                ) {
                  event.preventDefault();
                  onSaveEdit(message);
                }
              }}
              rows={2}
              value={editDraft}
            />
            {editError ? (
              <p className="text-xs font-semibold text-[color:var(--px-error)]">
                {editError}
              </p>
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
          <p className="whitespace-pre-wrap break-words text-sm leading-6">
            {message.body}
          </p>
        )}
        <div
          className={`mt-2 flex items-center justify-end gap-1 text-[10px] ${mine ? "text-blue-100" : "text-[color:var(--px-text-muted)]"}`}
        >
          {message.editedAt ? <span>Edited</span> : null}
          <span>{formatMessageTime(message.createdAt)}</span>
          {mine ? <MessageStateIcon message={message} /> : null}
        </div>
      </div>
    </div>
  );
}

function ConversationEventCard({
  event,
  highlighted,
  refCallback,
}: {
  event: WorkspaceConversationEvent;
  highlighted: boolean;
  refCallback: (node: HTMLDivElement | null) => void;
}) {
  const versionNumber = getSnapshotNumber(event.snapshot, "versionNumber");
  const amountMinor = getSnapshotString(event.snapshot, "amountMinor");
  const currency = getSnapshotString(event.snapshot, "currency");
  const reason = getSnapshotString(event.snapshot, "reason");
  const description = getSnapshotString(event.snapshot, "description");
  const dealEvent =
    event.type === "DEAL_CREATED" || event.type.startsWith("DEAL_");
  const objection = event.type === "PROPOSAL_OBJECTION_RAISED";
  const accepted = event.type === "PROPOSAL_ACCEPTED";
  const rejected = event.type === "PROPOSAL_REJECTED";
  const termsEvent = [
    "PROPOSAL_SUBMITTED",
    "PROPOSAL_REVISION_SUBMITTED",
  ].includes(event.type);
  const title = dealEvent
    ? "Deal record created"
    : objection
      ? `Objection to proposal version ${versionNumber ?? ""}`.trim()
      : accepted
        ? `Proposal version ${versionNumber ?? ""} accepted`.trim()
        : rejected
          ? `Proposal version ${versionNumber ?? ""} rejected`.trim()
          : event.type === "PROPOSAL_REVISION_SUBMITTED"
            ? `Proposal revision ${versionNumber ?? ""} submitted`.trim()
            : event.type === "PROPOSAL_SUBMITTED"
              ? `Proposal version ${versionNumber ?? ""} submitted`.trim()
              : formatEventType(event.type);

  return (
    <div
      aria-current={highlighted ? "true" : undefined}
      className="flex scroll-mt-24 justify-center"
      data-event-id={event.id}
      ref={refCallback}
    >
      <article
        className={`w-full max-w-xl overflow-hidden rounded-3xl border bg-[color:var(--px-surface)] shadow-sm transition ${
          highlighted
            ? "border-[color:var(--px-warning)] ring-4 ring-[color:var(--px-warning)]/30"
            : "border-[color:var(--px-border)]"
        }`}
      >
        <div
          className={`flex items-center justify-between gap-3 px-4 py-3 ${
            objection
              ? "bg-amber-500/10 text-amber-800 dark:text-amber-200"
              : rejected
                ? "bg-red-500/10 text-red-700 dark:text-red-200"
                : accepted || dealEvent
                  ? "bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
                  : "bg-[color:var(--px-primary-soft)] text-[color:var(--px-primary)]"
          }`}
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-current/10">
              {dealEvent ? (
                <Handshake aria-hidden size={17} />
              ) : (
                <ShieldCheck aria-hidden size={17} />
              )}
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] opacity-65">
                PerX system record
              </p>
              <h3 className="truncate text-sm font-black">{title}</h3>
            </div>
          </div>
          <span className="shrink-0 text-[10px] font-bold opacity-70">
            {formatMessageTime(event.createdAt)}
          </span>
        </div>
        <div className="p-4">
          {amountMinor && currency ? (
            <p className="text-xl font-black text-[color:var(--px-text)]">
              {formatMinorMoney(amountMinor, currency)}
            </p>
          ) : null}
          {description && termsEvent ? (
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[color:var(--px-text-muted)]">
              {description}
            </p>
          ) : null}
          {reason ? (
            <blockquote className="mt-2 border-l-4 border-amber-400 pl-3 text-sm leading-6 text-[color:var(--px-text)]">
              {reason}
            </blockquote>
          ) : null}
          <p className="mt-3 text-xs leading-5 text-[color:var(--px-text-muted)]">
            {termsEvent
              ? "This submitted version is locked. Any term change requires a new numbered revision."
              : accepted
                ? "Acceptance applies only to this exact locked version and is retained in the Deal history."
                : dealEvent
                  ? "This is an agreement record. Online payment is not active, and PerX has not collected or held funds."
                  : objection
                    ? "The submitted terms remain unchanged. The proposal creator can prepare a separate revision."
                    : rejected
                      ? "This decision is retained in the proposal history."
                      : "This system event is retained as part of the conversation history."}
          </p>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-[color:var(--px-border)] pt-3">
            <p className="text-[10px] font-bold text-[color:var(--px-text-muted)]">
              {event.actorName
                ? `Recorded by ${event.actorName}`
                : "Recorded by PerX"}
            </p>
            {event.dealHref ? (
              <Link
                className="text-xs font-black text-[color:var(--px-primary)] hover:underline"
                href={event.dealHref}
              >
                Open Deal
              </Link>
            ) : termsEvent || objection ? (
              <Link
                className="text-xs font-black text-[color:var(--px-primary)] hover:underline"
                href="/app/proposals"
              >
                Review proposals
              </Link>
            ) : null}
          </div>
        </div>
      </article>
    </div>
  );
}

function DealSummaryCard({
  deal,
  href,
}: {
  deal: NonNullable<WorkspaceConversation["deal"]>;
  href?: string;
}) {
  const simulated = deal.settlementMode !== "PROVIDER_DISABLED";

  return (
    <article className="overflow-hidden rounded-3xl border border-[color:var(--px-border)] bg-[color:var(--px-surface)] shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 bg-[linear-gradient(135deg,var(--px-navy),var(--px-navy-3))] px-4 py-3 text-white">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/10 ring-1 ring-white/15">
            <Handshake aria-hidden size={19} />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/60">
              Linked Deal {deal.versionLabel ? `· ${deal.versionLabel}` : ""}
            </p>
            <h3 className="truncate text-sm font-black">{deal.title}</h3>
          </div>
        </div>
        <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ring-1 ring-white/15">
          {deal.status.replaceAll("_", " ")}
        </span>
      </div>
      <div className="grid gap-3 p-4 sm:grid-cols-[1fr_auto] sm:items-end">
        <div>
          <p className="text-lg font-black text-[color:var(--px-text)]">
            {formatMinorMoney(deal.amountMinor, deal.currency)}
          </p>
          <p className="mt-1 max-w-xl text-xs leading-5 text-[color:var(--px-text-muted)]">
            {simulated
              ? "Simulated agreement-state tracking only. PerX has not collected, held, transferred, or released funds."
              : "Online payment is not active. This card records agreed terms only; no funds have been collected or held."}
          </p>
        </div>
        {href ? (
          <Link
            className="inline-flex min-h-10 items-center justify-center rounded-xl bg-[color:var(--px-primary)] px-4 text-sm font-black text-white transition hover:bg-[color:var(--px-primary-strong)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)]"
            href={href}
          >
            View Deal
          </Link>
        ) : null}
      </div>
    </article>
  );
}

function DateSeparator({ value }: { value: string }) {
  return (
    <div className="flex items-center gap-3 py-1" role="separator">
      <span className="h-px flex-1 bg-[color:var(--px-border)]" />
      <span className="rounded-full bg-[color:var(--px-surface)] px-3 py-1 text-[10px] font-black uppercase tracking-wide text-[color:var(--px-text-muted)] shadow-sm ring-1 ring-[color:var(--px-border)]">
        {formatMessageDay(value)}
      </span>
      <span className="h-px flex-1 bg-[color:var(--px-border)]" />
    </div>
  );
}

function MessageActionMenu({
  canEdit,
  conversationId,
  isOpen,
  message,
  mine,
  onClose,
  onDelete,
  onReply,
  onStartEdit,
  onToggle,
}: {
  canEdit: boolean;
  conversationId: string;
  isOpen: boolean;
  message: WorkspaceMessage;
  mine: boolean;
  onClose: () => void;
  onDelete: () => void;
  onReply: () => void;
  onStartEdit: () => void;
  onToggle: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const action = (fn: () => void) => {
    onClose();
    fn();
  };

  const reportHref = `/app/reports/new?targetType=MESSAGE&targetId=${encodeURIComponent(message.id)}&conversationId=${encodeURIComponent(conversationId)}&messageId=${encodeURIComponent(message.id)}`;

  return (
    <div className="relative inline-flex">
      <button
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label="Message actions"
        className={`grid h-7 w-7 shrink-0 list-none place-items-center rounded-full cursor-pointer focus:outline-none focus-visible:ring-2 ${
          mine
            ? "text-blue-100 hover:bg-white/10 focus-visible:ring-white"
            : "text-[color:var(--px-text-muted)] hover:bg-[color:var(--px-muted)] focus-visible:ring-[color:var(--px-focus)]"
        }`}
        onClick={onToggle}
        ref={triggerRef}
        type="button"
      >
        <MoreVertical aria-hidden size={15} />
      </button>
      {isOpen ? (
        <div
          className="absolute right-0 z-30 mt-1 grid min-w-36 gap-1 rounded-xl border border-[color:var(--px-border)] bg-[color:var(--px-surface)] p-1 text-[color:var(--px-text)] shadow-lg"
          ref={menuRef}
          role="menu"
        >
          <button
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-bold hover:bg-[color:var(--px-muted)]"
            onClick={() => {
              action(onReply);
            }}
            role="menuitem"
            type="button"
          >
            <Reply aria-hidden size={14} />
            Reply
          </button>
          <button
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-bold hover:bg-[color:var(--px-muted)]"
            onClick={() => {
              action(() => {
                void navigator.clipboard?.writeText(message.body);
              });
            }}
            role="menuitem"
            type="button"
          >
            <Copy aria-hidden size={14} />
            Copy
          </button>
          {canEdit ? (
            <button
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-bold hover:bg-[color:var(--px-muted)]"
              onClick={() => {
                action(onStartEdit);
              }}
              role="menuitem"
              type="button"
            >
              <Pencil aria-hidden size={14} />
              Edit
            </button>
          ) : null}
          {canEdit ? (
            <button
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-bold text-[color:var(--px-error)] hover:bg-red-50 dark:hover:bg-red-950/30"
              onClick={() => {
                action(onDelete);
              }}
              role="menuitem"
              type="button"
            >
              <Trash2 aria-hidden size={14} />
              Remove message
            </button>
          ) : null}
          {!message.id.startsWith("local-") ? (
            <Link
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-bold hover:bg-[color:var(--px-muted)]"
              href={reportHref}
              onClick={onClose}
              role="menuitem"
            >
              <Flag aria-hidden size={14} />
              Report
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ConversationDetails({
  conversation,
  onClose,
  onRemove,
  open,
}: {
  conversation?: WorkspaceConversation;
  onClose: () => void;
  onRemove: () => void;
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
        <h3 className="mt-3 truncate font-black text-[color:var(--px-text)]">
          {conversation.participantName}
        </h3>
        <p className="truncate text-xs text-[color:var(--px-text-muted)]">
          @{conversation.participantUsername ?? "perx-member"}
        </p>
        <p className="mt-2 text-xs text-[color:var(--px-text-muted)]">
          {presenceLabel(conversation.participantPresence) ??
            conversation.participantRole ??
            "PerX member"}
        </p>
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
            <form
              action={blockUserAction.bind(null, conversation.participantId)}
            >
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
          Deal workspaces are separate from chat. Real custody, transfers, and
          protected-funds actions are not active in beta.
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

      <div className="rounded-3xl border border-[color:var(--px-border)] bg-[color:var(--px-surface)] p-4">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[color:var(--px-muted)] text-[color:var(--px-text-muted)]">
            <UserRoundX aria-hidden size={18} />
          </span>
          <div>
            <h3 className="text-sm font-black text-[color:var(--px-text)]">
              Your chat list
            </h3>
            <p className="mt-1 text-xs leading-5 text-[color:var(--px-text-muted)]">
              Removing this chat only hides it for you. It does not erase
              messages, Deal records, reports, or another participant&apos;s
              copy.
            </p>
          </div>
        </div>
        <button
          className="mt-3 inline-flex min-h-10 w-full items-center justify-center rounded-xl border border-[color:var(--px-border-strong)] px-4 text-sm font-bold text-[color:var(--px-text)] transition hover:bg-[color:var(--px-muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)]"
          onClick={onRemove}
          type="button"
        >
          Remove chat for me
        </button>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden min-h-0 border-l border-[color:var(--px-border)] 2xl:flex">
        {content}
      </aside>
      {open ? (
        <div
          className="absolute inset-0 z-40 bg-black/30 2xl:hidden"
          role="presentation"
          onClick={onClose}
        >
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
  const dimensions =
    size === "lg" ? "mx-auto h-20 w-20 text-xl" : "h-11 w-11 text-sm";

  return (
    <div className="relative shrink-0">
      <div
        className={`${dimensions} grid overflow-hidden place-items-center rounded-full bg-[color:var(--px-primary)] font-black text-white ring-2 ring-[color:var(--px-surface)]`}
      >
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

function persistDraft(
  storageKey: string,
  conversationId: string,
  draft: string,
) {
  try {
    const stored = JSON.parse(
      window.sessionStorage.getItem(storageKey) ?? "{}",
    ) as Record<string, unknown>;
    if (draft) stored[conversationId] = draft;
    else delete stored[conversationId];
    window.sessionStorage.setItem(storageKey, JSON.stringify(stored));
  } catch {
    window.sessionStorage.setItem(
      storageKey,
      draft ? JSON.stringify({ [conversationId]: draft }) : "{}",
    );
  }
}

function parseConversationEnvelope(
  value: unknown,
): WorkspaceConversation[] | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const conversations = (value as { conversations?: unknown }).conversations;
  if (!Array.isArray(conversations)) return null;

  return conversations.flatMap((candidate) => {
    if (
      !candidate ||
      typeof candidate !== "object" ||
      Array.isArray(candidate)
    ) {
      return [];
    }
    const conversation = candidate as Partial<WorkspaceConversation>;
    if (
      typeof conversation.id !== "string" ||
      typeof conversation.participantName !== "string" ||
      !Array.isArray(conversation.messages)
    ) {
      return [];
    }
    const messages = conversation.messages.filter(
      (message): message is WorkspaceMessage =>
        Boolean(message) &&
        typeof message.id === "string" &&
        typeof message.body === "string" &&
        typeof message.createdAt === "string" &&
        typeof message.senderId === "string" &&
        typeof message.senderName === "string",
    );
    const events = Array.isArray(conversation.events)
      ? conversation.events.filter(
          (event): event is WorkspaceConversationEvent =>
            Boolean(event) &&
            typeof event.id === "string" &&
            typeof event.createdAt === "string" &&
            isConversationEventType(event.type) &&
            Boolean(event.snapshot) &&
            typeof event.snapshot === "object" &&
            !Array.isArray(event.snapshot),
        )
      : undefined;

    return [{ ...conversation, events, messages } as WorkspaceConversation];
  });
}

function isConversationEventType(
  value: unknown,
): value is WorkspaceConversationEvent["type"] {
  return [
    "PROPOSAL_SUBMITTED",
    "PROPOSAL_OBJECTION_RAISED",
    "PROPOSAL_REVISION_CREATED",
    "PROPOSAL_REVISION_SUBMITTED",
    "PROPOSAL_ACCEPTED",
    "PROPOSAL_REJECTED",
    "DEAL_CREATED",
    "DEAL_STATUS_CHANGED",
    "MILESTONE_SUBMITTED",
    "MILESTONE_APPROVED",
    "SIMULATED_RELEASE_RECORDED",
  ].includes(value as WorkspaceConversationEvent["type"]);
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
  const dayDiff = Math.round(
    (today.getTime() - thatDay.getTime()) / 86_400_000,
  );

  if (dayDiff === 0) return formatMessageTime(value);
  if (dayDiff === 1) return "Yesterday";
  return new Intl.DateTimeFormat(undefined, {
    day: "2-digit",
    month: "short",
  }).format(date);
}

function shouldShowDateSeparator(
  previous: string | undefined,
  current: string,
) {
  if (!previous) return true;
  const previousDate = new Date(previous);
  const currentDate = new Date(current);
  if (
    Number.isNaN(previousDate.getTime()) ||
    Number.isNaN(currentDate.getTime())
  ) {
    return false;
  }
  return previousDate.toDateString() !== currentDate.toDateString();
}

function getSnapshotString(snapshot: Record<string, unknown>, key: string) {
  const value = snapshot[key];
  return typeof value === "string" ? value : null;
}

function getSnapshotNumber(snapshot: Record<string, unknown>, key: string) {
  const value = snapshot[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function formatEventType(value: WorkspaceConversationEvent["type"]) {
  return value
    .toLocaleLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toLocaleUpperCase() + part.slice(1))
    .join(" ");
}

function formatMessageDay(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Conversation";

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const messageDay = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );
  const dayDiff = Math.round(
    (today.getTime() - messageDay.getTime()) / 86_400_000,
  );
  if (dayDiff === 0) return "Today";
  if (dayDiff === 1) return "Yesterday";
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: date.getFullYear() === now.getFullYear() ? undefined : "numeric",
  }).format(date);
}

function formatMinorMoney(value: string, currency: string) {
  try {
    const amount = Number(BigInt(value)) / 100;
    return new Intl.NumberFormat(undefined, {
      currency,
      maximumFractionDigits: 2,
      minimumFractionDigits: 0,
      style: "currency",
    }).format(amount);
  } catch {
    return `${currency} ${value}`;
  }
}

function MessageStateIcon({ message }: { message: WorkspaceMessage }) {
  if (message.status === "sending") {
    return <Clock3 aria-label="Sending" size={13} />;
  }
  if (message.status === "failed") {
    return <span aria-label="Failed">Failed</span>;
  }
  if (message.readByOtherParticipants) {
    return (
      <CheckCheck aria-label="Read" className="text-green-200" size={14} />
    );
  }
  return <Check aria-label="Sent" size={13} />;
}
