"use client";

import * as Dialog from "@radix-ui/react-dialog";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  Fragment,
  useCallback,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
  type FormEvent,
} from "react";
import {
  ArrowDown,
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
import { ConversationDealOfferDialog } from "@/components/messages/conversation-deal-offer-dialog";
import { FeatureDirectory } from "@/components/navigation/feature-directory";
import { useConfirm, useToast } from "@/components/ui/feedback-provider";
import {
  deleteMessageAction,
  editMessageAction,
  markConversationReadAction,
  removeConversationForMeAction,
  sendMessageAction,
} from "@/features/messages/actions";
import { blockUserAction } from "@/features/network/actions";
import { shouldSubmitMessage } from "@/lib/messages/composer-keyboard";
import { isDealComposerTrigger } from "@/lib/messages/deal-trigger";
import { MAX_LOADED_CONVERSATIONS } from "@/lib/messages/limits";

type ReplyPreview = {
  body: string;
  deletedAt?: string | null;
  id: string;
  senderId: string;
  senderName: string;
};

export type WorkspaceMessage = {
  body: string;
  canMutate?: boolean;
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
  proposalHref?: string | null;
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
  dealOffer?: {
    currency: string;
    opportunityTitle: string;
  };
  events?: WorkspaceConversationEvent[];
  historyLoaded?: boolean;
  id: string;
  lastMessage?: string;
  messages: WorkspaceMessage[];
  olderMessagesCursor?: string | null;
  opportunityTitle?: string;
  participantId?: string | null;
  participantImageUrl?: string | null;
  participantName: string;
  participantPresence?: "hidden" | "online" | "recent" | "offline";
  participantProfile?: {
    biography: string;
    headline: string;
    location?: string | null;
    skills: string[];
  };
  participantRole?: string;
  participantUsername?: string;
  timestamp?: string;
  unreadCount?: number;
};

type WorkspaceMessageMutation = {
  body: string;
  conversationId: string;
  deletedAt: string | null;
  editedAt: string | null;
  id: string;
};

type WorkspaceConversationListSnapshot = {
  ids: string[];
  nextCursor: string | null;
};

const subscribeToHydration = () => () => {};
const getBrowserSnapshot = () => true;
const getServerSnapshot = () => false;

export function MessageWorkspace({
  backHref,
  conversations,
  currentUserId,
  defaultConversationId,
  highlightEventId,
  highlightMessageId,
  initialMutationCursor,
  olderConversationsCursor,
  userRoles,
}: {
  backHref?: string;
  conversations: WorkspaceConversation[];
  currentUserId: string;
  defaultConversationId?: string;
  highlightEventId?: string;
  highlightMessageId?: string;
  initialMutationCursor?: string;
  olderConversationsCursor?: string | null;
  userRoles?: readonly string[];
}) {
  const [activeId, setActiveId] = useState(
    defaultConversationId ?? conversations[0]?.id ?? "",
  );
  const [activatedConversationId, setActivatedConversationId] = useState(
    defaultConversationId ?? "",
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
  const [liveConnectionVersion, setLiveConnectionVersion] = useState(0);
  const [isPending, startTransition] = useTransition();
  const [isOlderPending, startOlderTransition] = useTransition();
  const [isOlderConversationsPending, startOlderConversationsTransition] =
    useTransition();
  const [isEditPending, startEditTransition] = useTransition();
  const [openActionMenuMessageId, setOpenActionMenuMessageId] = useState("");
  const [dealOfferOpen, setDealOfferOpen] = useState(false);
  const draftStorageKey = `perx:messages:${currentUserId}:drafts`;
  const filterStorageKey = `perx:messages:${currentUserId}:filter`;
  const listScrollStorageKey = `perx:messages:${currentUserId}:list-scroll`;
  const queryStorageKey = `perx:messages:${currentUserId}:query`;
  const conversationButtonRefs = useRef<
    Record<string, HTMLButtonElement | null>
  >({});
  const conversationHeaderRef = useRef<HTMLDivElement>(null);
  const historyRef = useRef<HTMLDivElement>(null);
  const appNavigationScrollRef = useRef<{
    conversationId: string;
    distanceFromBottom: number;
  } | null>(null);
  const inlineDetailHistoryRef = useRef(false);
  const activeIdRef = useRef(activeId);
  const mobileDetailOpenRef = useRef(mobileDetailOpen);
  const syncedConversationsRef = useRef(syncedConversations);
  const historyScrollAnchorRef = useRef<{
    conversationId: string;
    entryId?: string;
    entryTop?: number;
    scrollHeight: number;
    scrollTop: number;
  } | null>(null);
  const [historyAnchorVersion, setHistoryAnchorVersion] = useState(0);
  const [olderConversationCursor, setOlderConversationCursor] = useState(
    olderConversationsCursor ?? null,
  );
  const [documentVisible, setDocumentVisible] = useState(false);
  const [historyAtBottom, setHistoryAtBottom] = useState(false);
  const [historyPositioned, setHistoryPositioned] = useState(false);
  const [newMessageCount, setNewMessageCount] = useState(0);
  const useBrowserFormatting = useSyncExternalStore(
    subscribeToHydration,
    getBrowserSnapshot,
    getServerSnapshot,
  );
  const [isMobileViewport, setIsMobileViewport] = useState(
    () =>
      typeof window !== "undefined" &&
      (typeof window.matchMedia !== "function" ||
        window.matchMedia("(max-width: 1023px)").matches),
  );
  const isComposingRef = useRef(false);
  const historyAtBottomRef = useRef(false);
  const historyPositionedRef = useRef(false);
  const pendingLatestPositionRef = useRef(
    highlightMessageId || highlightEventId
      ? ""
      : (defaultConversationId ?? conversations[0]?.id ?? ""),
  );
  const previousTimelineRef = useRef<{
    conversationId: string;
    messageIds: Set<string>;
  } | null>(null);
  const restoringHistoryRef = useRef(false);
  const listRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const mutationCursorsRef = useRef<Record<string, string>>(
    defaultConversationId && initialMutationCursor
      ? { [defaultConversationId]: initialMutationCursor }
      : {},
  );
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const conversationAuthorizationAbortRef = useRef<AbortController | null>(
    null,
  );
  const conversationAuthorizationRequestRef = useRef(0);
  const conversationOpenRequestRef = useRef(0);
  const fullHistoryConversationIdsRef = useRef(
    new Set(
      conversations
        .filter((conversation) => conversation.historyLoaded !== false)
        .map((conversation) => conversation.id),
    ),
  );
  const editingMessageIdRef = useRef(editingMessageId);
  const confirm = useConfirm();
  const toast = useToast();

  useLayoutEffect(() => {
    activeIdRef.current = activeId;
    historyAtBottomRef.current = historyAtBottom;
    historyPositionedRef.current = historyPositioned;
    mobileDetailOpenRef.current = mobileDetailOpen;
    syncedConversationsRef.current = syncedConversations;
    editingMessageIdRef.current = editingMessageId;
  }, [
    activeId,
    editingMessageId,
    historyAtBottom,
    historyPositioned,
    mobileDetailOpen,
    syncedConversations,
  ]);

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
      setDrafts((current) => ({ ...restoredDrafts, ...current }));
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
    const updateVisibility = () =>
      setDocumentVisible(document.visibilityState === "visible");
    updateVisibility();
    document.addEventListener("visibilitychange", updateVisibility);
    return () =>
      document.removeEventListener("visibilitychange", updateVisibility);
  }, []);

  useEffect(() => () => conversationAuthorizationAbortRef.current?.abort(), []);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const media = window.matchMedia("(max-width: 1023px)");
    const updateViewport = () => setIsMobileViewport(media.matches);
    media.addEventListener?.("change", updateViewport);
    return () => media.removeEventListener?.("change", updateViewport);
  }, []);

  const toggleActionMenu = useCallback((messageId: string) => {
    setOpenActionMenuMessageId((current) =>
      current === messageId ? "" : messageId,
    );
  }, []);

  const closeActionMenu = useCallback(() => {
    setOpenActionMenuMessageId("");
    setDealOfferOpen(false);
  }, []);

  const updateConversations = useEffectEvent(
    (
      incoming: WorkspaceConversation[],
      messageMutations: WorkspaceMessageMutation[] = [],
      conversationList: WorkspaceConversationListSnapshot | null = null,
    ) => {
      if (conversationList) {
        setOlderConversationCursor(conversationList.nextCursor);
        if (
          activeIdRef.current &&
          !conversationList.ids.includes(activeIdRef.current) &&
          !incoming.some(
            (conversation) => conversation.id === activeIdRef.current,
          )
        ) {
          activeIdRef.current = "";
          setActivatedConversationId("");
          setActiveId("");
        }
      }
      setSyncedConversations((current) =>
        mergeWorkspaceConversationSnapshots(
          current,
          incoming,
          messageMutations,
          activeIdRef.current,
          conversationList,
          highlightMessageId,
          highlightEventId,
        ),
      );
    },
  );

  const reconcileConversationSnapshot = useEffectEvent(
    async (
      incoming: NonNullable<ReturnType<typeof parseConversationStreamEnvelope>>,
    ) => {
      const conversationList = incoming.conversationList;
      if (!conversationList) {
        updateConversations(
          incoming.conversations,
          incoming.messageMutations,
          null,
        );
        return;
      }

      const requestVersion = ++conversationAuthorizationRequestRef.current;
      conversationAuthorizationAbortRef.current?.abort();
      conversationAuthorizationAbortRef.current = null;
      if (!conversationList.nextCursor) {
        updateConversations(
          incoming.conversations,
          incoming.messageMutations,
          conversationList,
        );
        return;
      }

      const listedIds = new Set(conversationList.ids);
      const incomingIds = new Set(
        incoming.conversations.map((conversation) => conversation.id),
      );
      const omittedIds = syncedConversationsRef.current
        .map((conversation) => conversation.id)
        .filter((id) => !listedIds.has(id) && !incomingIds.has(id));
      if (!omittedIds.length) {
        updateConversations(
          incoming.conversations,
          incoming.messageMutations,
          conversationList,
        );
        return;
      }

      const controller = new AbortController();
      conversationAuthorizationAbortRef.current = controller;
      const timeout = window.setTimeout(() => controller.abort(), 5000);
      let authorizedIds: string[] | null = null;
      try {
        const response = await fetch("/api/messages/authorization", {
          body: JSON.stringify({ conversationIds: omittedIds }),
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          method: "POST",
          signal: controller.signal,
        });
        const payload = (await response.json().catch(() => null)) as {
          ids?: unknown;
        } | null;
        if (
          response.ok &&
          Array.isArray(payload?.ids) &&
          payload.ids.length <= MAX_LOADED_CONVERSATIONS &&
          payload.ids.every((id) => typeof id === "string")
        ) {
          authorizedIds = payload.ids;
        }
      } catch {
        // A later bounded refresh retries without treating network failure as revocation.
      } finally {
        window.clearTimeout(timeout);
        if (conversationAuthorizationAbortRef.current === controller) {
          conversationAuthorizationAbortRef.current = null;
        }
      }
      if (requestVersion !== conversationAuthorizationRequestRef.current)
        return;
      if (!authorizedIds) {
        updateConversations(
          incoming.conversations,
          incoming.messageMutations,
          null,
        );
        return;
      }

      updateConversations(incoming.conversations, incoming.messageMutations, {
        ...conversationList,
        ids: [
          ...new Set([
            ...conversationList.ids,
            ...incoming.conversations.map((conversation) => conversation.id),
            ...authorizedIds,
          ]),
        ],
      });
    },
  );

  const openHistoryConversation = useEffectEvent(
    async (conversationId: string) => {
      const requestId = ++conversationOpenRequestRef.current;
      try {
        const response = await fetch(
          `/api/messages/sync?conversationId=${encodeURIComponent(conversationId)}`,
          { cache: "no-store" },
        );
        if (requestId !== conversationOpenRequestRef.current) return;
        if (!response.ok) {
          setSyncedConversations((current) =>
            current.filter(
              (conversation) => conversation.id !== conversationId,
            ),
          );
          return;
        }
        const incoming = parseConversationStreamEnvelope(await response.json());
        if (requestId !== conversationOpenRequestRef.current) return;
        if (
          !incoming ||
          !incoming.conversations.some(
            (conversation) => conversation.id === conversationId,
          )
        ) {
          setSyncedConversations((current) =>
            current.filter(
              (conversation) => conversation.id !== conversationId,
            ),
          );
          return;
        }
        if (incoming.mutationCursor) {
          mutationCursorsRef.current[conversationId] = incoming.mutationCursor;
        }
        if (incoming.conversationList) {
          setOlderConversationCursor(incoming.conversationList.nextCursor);
        }
        setSyncedConversations((current) =>
          mergeWorkspaceConversationSnapshots(
            current,
            incoming.conversations,
            incoming.messageMutations,
            activeIdRef.current,
            incoming.conversationList,
            highlightMessageId,
            highlightEventId,
          ),
        );
        pendingLatestPositionRef.current = conversationId;
        historyPositionedRef.current = false;
        historyAtBottomRef.current = false;
        setHistoryPositioned(false);
        setHistoryAtBottom(false);
        setNewMessageCount(0);
        setReplyTarget(null);
        setSendError("");
        setDetailsOpen(false);
        inlineDetailHistoryRef.current = true;
        setActivatedConversationId(conversationId);
        setActiveId(conversationId);
        setMobileDetailOpen(true);
        document.documentElement.classList.add(
          "perx-mobile-conversation-active",
        );
        window.requestAnimationFrame(() =>
          conversationHeaderRef.current?.focus(),
        );
      } catch {
        if (requestId !== conversationOpenRequestRef.current) return;
        // Keep the current authorized conversation visible on transient failures.
      }
    },
  );

  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      const conversationId = (
        event.state as {
          perxMessagesConversationId?: unknown;
        } | null
      )?.perxMessagesConversationId;
      if (
        typeof conversationId === "string" &&
        syncedConversationsRef.current.some(
          (conversation) => conversation.id === conversationId,
        )
      ) {
        void openHistoryConversation(conversationId);
        return;
      }
      if (!inlineDetailHistoryRef.current && !mobileDetailOpenRef.current) {
        return;
      }
      inlineDetailHistoryRef.current = false;
      setActivatedConversationId("");
      setMobileDetailOpen(false);
      window.requestAnimationFrame(() => {
        conversationButtonRefs.current[activeIdRef.current]?.focus();
      });
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    let active = true;
    let eventSource: EventSource | null = null;
    let fallbackInterval: number | null = null;
    let unavailableHandled = false;
    let syncInFlight = false;
    let syncVersion = 0;
    const stopFallback = () => {
      if (fallbackInterval === null) return;
      window.clearInterval(fallbackInterval);
      fallbackInterval = null;
    };
    const recoverAuthorizedList = async () => {
      if (unavailableHandled) return;
      unavailableHandled = true;
      syncVersion += 1;
      conversationOpenRequestRef.current += 1;
      eventSource?.close();
      stopFallback();
      setActivatedConversationId("");
      setMobileDetailOpen(false);
      setLocalMessages({});
      setReplyTarget(null);
      setSyncedConversations([]);
      setLiveState("fallback");
      try {
        const response = await fetch("/api/messages/sync", {
          cache: "no-store",
        });
        if (!response.ok) return;
        const incoming = parseConversationStreamEnvelope(await response.json());
        if (!active || !incoming) return;
        const authorizedConversations = sortWorkspaceConversations(
          applyWorkspaceMessageMutations(
            incoming.conversations,
            incoming.messageMutations,
          ),
        );
        setSyncedConversations(authorizedConversations);
        if (incoming.conversationList) {
          setOlderConversationCursor(incoming.conversationList.nextCursor);
        }
        setActiveId(authorizedConversations[0]?.id ?? "");
        setLiveConnectionVersion((version) => version + 1);
      } catch {
        // Private conversation state remains cleared when access cannot be recovered.
      }
    };
    const sync = async () => {
      if (syncInFlight) return;
      syncInFlight = true;
      const requestVersion = ++syncVersion;
      try {
        const params = new URLSearchParams();
        if (activeId) {
          params.set("conversationId", activeId);
          const mutationCursor = mutationCursorsRef.current[activeId];
          if (mutationCursor) params.set("mutationCursor", mutationCursor);
        }
        const response = await fetch(
          `/api/messages/sync${params.size ? `?${params}` : ""}`,
          { cache: "no-store" },
        );
        if (!active || requestVersion !== syncVersion) return;
        if (response.status === 400 && activeId) {
          delete mutationCursorsRef.current[activeId];
          void recoverAuthorizedList();
          return;
        }
        if ([401, 403, 404].includes(response.status)) {
          void recoverAuthorizedList();
          return;
        }
        if (!response.ok) return;
        const incoming = parseConversationStreamEnvelope(await response.json());
        if (active && requestVersion === syncVersion && incoming) {
          if (activeId && incoming.mutationCursor) {
            mutationCursorsRef.current[activeId] = incoming.mutationCursor;
          }
          await reconcileConversationSnapshot(incoming);
        }
      } catch {
        // Polling is the fallback freshness path; persisted messages remain available after refresh.
      } finally {
        syncInFlight = false;
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
      const params = new URLSearchParams();
      if (activeId) {
        params.set("conversationId", activeId);
        const mutationCursor = mutationCursorsRef.current[activeId];
        if (mutationCursor) params.set("mutationCursor", mutationCursor);
      }
      const url = `/api/messages/events${params.size ? `?${params}` : ""}`;
      eventSource = new EventSource(url);
      eventSource.addEventListener("open", () => {
        if (!active) return;
        setLiveState("live");
        stopFallback();
      });
      eventSource.addEventListener("conversations", (event) => {
        if (!active) return;
        syncVersion += 1;
        let incoming: ReturnType<typeof parseConversationStreamEnvelope> = null;
        try {
          incoming = parseConversationStreamEnvelope(
            JSON.parse((event as MessageEvent).data),
          );
        } catch {
          return;
        }
        if (incoming) {
          const messageEvent = event as MessageEvent;
          if (activeId && messageEvent.lastEventId) {
            mutationCursorsRef.current[activeId] = messageEvent.lastEventId;
          }
          void reconcileConversationSnapshot(incoming);
          stopFallback();
          setLiveState("live");
          window.dispatchEvent(new Event("perx-unread-refresh"));
        }
      });
      eventSource.addEventListener("mutation-checkpoint", (event) => {
        if (!active || !activeId) return;
        const messageEvent = event as MessageEvent;
        if (messageEvent.lastEventId) {
          mutationCursorsRef.current[activeId] = messageEvent.lastEventId;
        }
      });
      eventSource.addEventListener("stream-error", () => {
        if (!active) return;
        setLiveState("reconnecting");
        startFallback();
      });
      eventSource.addEventListener("unavailable", () => {
        if (!active) return;
        void recoverAuthorizedList();
      });
      eventSource.onerror = () => {
        if (!active) return;
        setLiveState("reconnecting");
        startFallback();
      };
    }

    return () => {
      active = false;
      syncVersion += 1;
      eventSource?.close();
      stopFallback();
    };
  }, [activeId, liveConnectionVersion]);

  const activeConversation =
    syncedConversations.find((conversation) => conversation.id === activeId) ??
    syncedConversations[0];
  const historyVisible =
    Boolean(activeConversation) && (!isMobileViewport || mobileDetailOpen);

  useEffect(() => {
    const node = historyRef.current;
    if (!node || !historyVisible) {
      historyAtBottomRef.current = false;
      setHistoryAtBottom(false);
      return;
    }
    const conversationId = activeConversation?.id;
    const positionPendingLatest = () => {
      if (
        !conversationId ||
        !node.clientHeight ||
        highlightedMessageId ||
        pendingLatestPositionRef.current !== conversationId
      ) {
        return false;
      }
      node.scrollTop = node.scrollHeight;
      historyPositionedRef.current = true;
      historyAtBottomRef.current = true;
      setHistoryPositioned(true);
      setHistoryAtBottom(true);
      setNewMessageCount(0);
      return true;
    };
    positionPendingLatest();
    const updateHistoryPosition = (event?: Event) => {
      if (!node.clientHeight || !historyPositionedRef.current) {
        historyAtBottomRef.current = false;
        setHistoryAtBottom(false);
        return;
      }
      const distanceFromBottom =
        node.scrollHeight - node.scrollTop - node.clientHeight;
      const atBottom = distanceFromBottom <= 72;
      if (
        !atBottom &&
        event &&
        pendingLatestPositionRef.current === conversationId
      ) {
        pendingLatestPositionRef.current = "";
      }
      historyAtBottomRef.current = atBottom;
      setHistoryAtBottom(atBottom);
      if (atBottom) setNewMessageCount(0);
    };
    updateHistoryPosition();
    const handleHistoryScroll = (event: Event) => updateHistoryPosition(event);
    node.addEventListener("scroll", handleHistoryScroll, { passive: true });
    let previousScrollHeight = node.scrollHeight;
    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(() => {
            const wasAtBottomBeforeResize =
              previousScrollHeight - node.scrollTop - node.clientHeight <= 72;
            if (
              !positionPendingLatest() &&
              (historyAtBottomRef.current || wasAtBottomBeforeResize) &&
              !restoringHistoryRef.current
            ) {
              node.scrollTop = node.scrollHeight;
            }
            previousScrollHeight = node.scrollHeight;
            updateHistoryPosition();
          });
    resizeObserver?.observe(node);
    if (node.firstElementChild) {
      resizeObserver?.observe(node.firstElementChild);
    }
    const viewport = window.visualViewport;
    const handleViewportResize = () => updateHistoryPosition();
    viewport?.addEventListener("resize", handleViewportResize);
    return () => {
      node.removeEventListener("scroll", handleHistoryScroll);
      resizeObserver?.disconnect();
      viewport?.removeEventListener("resize", handleViewportResize);
    };
  }, [activeConversation?.id, highlightedMessageId, historyVisible]);

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
  const latestPersistedEntry = [...timeline]
    .reverse()
    .find((entry) => entry.kind === "event" || !entry.id.startsWith("local-"));
  const latestEntryId = latestPersistedEntry?.id;
  const latestEntryKind = latestPersistedEntry?.kind;

  const loadOlderMessages = () => {
    const conversationId = activeConversation?.id;
    const cursor = activeConversation?.olderMessagesCursor;
    const node = historyRef.current;
    if (!conversationId || !cursor || isOlderPending) return;
    if (node) {
      const nodeTop = node.getBoundingClientRect().top;
      const anchorElement = Array.from(
        node.querySelectorAll<HTMLElement>(
          "[data-message-id], [data-event-id]",
        ),
      ).find((entry) => entry.getBoundingClientRect().bottom >= nodeTop);
      historyScrollAnchorRef.current = {
        conversationId,
        entryId:
          anchorElement?.dataset.messageId ?? anchorElement?.dataset.eventId,
        entryTop: anchorElement?.getBoundingClientRect().top,
        scrollHeight: node.scrollHeight,
        scrollTop: node.scrollTop,
      };
      restoringHistoryRef.current = true;
      historyAtBottomRef.current = false;
      setHistoryAtBottom(false);
    }
    setSendError("");

    startOlderTransition(async () => {
      try {
        const response = await fetch(
          `/api/messages/history?conversationId=${encodeURIComponent(conversationId)}&cursor=${encodeURIComponent(cursor)}`,
          { cache: "no-store" },
        );
        const payload = parseMessagePageEnvelope(await response.json());
        if (!response.ok || !payload) {
          throw new Error("Unable to load older messages.");
        }
        const existingMessageIds = new Set(
          activeConversation?.messages.map((message) => message.id),
        );
        const addedMessages = payload.items.some(
          (message) => !existingMessageIds.has(message.id),
        );
        setSyncedConversations((current) =>
          current.map((conversation) =>
            conversation.id === conversationId
              ? {
                  ...conversation,
                  messages: mergeWorkspaceMessages(
                    conversation.messages,
                    payload.items,
                  ),
                  olderMessagesCursor: payload.nextCursor,
                }
              : conversation,
          ),
        );
        if (addedMessages) {
          setHistoryAnchorVersion((version) => version + 1);
        } else {
          historyScrollAnchorRef.current = null;
          restoringHistoryRef.current = false;
        }
      } catch {
        historyScrollAnchorRef.current = null;
        restoringHistoryRef.current = false;
        toast({
          description: "Please try again.",
          title: "Unable to load older messages",
          tone: "error",
        });
      }
    });
  };

  const loadOlderConversations = () => {
    if (!olderConversationCursor || isOlderConversationsPending) return;

    startOlderConversationsTransition(async () => {
      try {
        const response = await fetch(
          `/api/messages/conversations?cursor=${encodeURIComponent(olderConversationCursor)}`,
          { cache: "no-store" },
        );
        const payload = parseConversationPageEnvelope(await response.json());
        if (!response.ok || !payload) {
          throw new Error("Unable to load older conversations.");
        }
        const currentIds = new Set(
          syncedConversationsRef.current.map((conversation) => conversation.id),
        );
        const addedCount = payload.items.filter(
          (conversation) => !currentIds.has(conversation.id),
        ).length;
        const reachedLimit =
          currentIds.size + addedCount >= MAX_LOADED_CONVERSATIONS;
        setSyncedConversations((current) => {
          const byId = new Map(
            current.map((conversation) => [conversation.id, conversation]),
          );
          for (const conversation of payload.items) {
            if (!byId.has(conversation.id))
              byId.set(conversation.id, conversation);
          }
          return sortWorkspaceConversations([...byId.values()]).slice(
            0,
            MAX_LOADED_CONVERSATIONS,
          );
        });
        setOlderConversationCursor(reachedLimit ? null : payload.nextCursor);
      } catch {
        toast({
          description: "Please try again.",
          title: "Unable to load older conversations",
          tone: "error",
        });
      }
    });
  };

  const preserveHistoryAcrossAppNavigation = (open: boolean) => {
    const node = historyRef.current;
    const conversationId = activeConversation?.id;
    if (open) {
      appNavigationScrollRef.current =
        node && conversationId
          ? {
              conversationId,
              distanceFromBottom:
                node.scrollHeight - node.scrollTop - node.clientHeight,
            }
          : null;
      return;
    }

    const anchor = appNavigationScrollRef.current;
    appNavigationScrollRef.current = null;
    if (!anchor) return;
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        const current = historyRef.current;
        if (!current || activeIdRef.current !== anchor.conversationId) return;
        current.scrollTop = Math.max(
          0,
          current.scrollHeight -
            current.clientHeight -
            anchor.distanceFromBottom,
        );
      });
    });
  };

  useLayoutEffect(() => {
    const node = historyRef.current;
    const conversationId = activeConversation?.id;
    if (
      !node ||
      !conversationId ||
      !historyVisible ||
      !node.clientHeight ||
      highlightedMessageId ||
      pendingLatestPositionRef.current !== conversationId
    ) {
      return;
    }
    node.scrollTo({ behavior: "auto", top: node.scrollHeight });
    historyPositionedRef.current = true;
    historyAtBottomRef.current = true;
    setHistoryPositioned(true);
    setHistoryAtBottom(true);
    setNewMessageCount(0);
    const frame = window.requestAnimationFrame(() => {
      node.scrollTop = node.scrollHeight;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [
    activeConversation?.id,
    highlightedMessageId,
    historyVisible,
    timeline.length,
  ]);

  useEffect(() => {
    const conversationId = activeConversation?.id;
    if (!conversationId) return;
    const messageIds = new Set(
      timeline
        .filter(
          (entry) =>
            entry.kind === "message" &&
            entry.message.senderId !== currentUserId &&
            !entry.message.id.startsWith("local-"),
        )
        .map((entry) => entry.id),
    );
    const previous = previousTimelineRef.current;
    previousTimelineRef.current = { conversationId, messageIds };
    if (
      !previous ||
      previous.conversationId !== conversationId ||
      !historyVisible ||
      !historyPositionedRef.current ||
      restoringHistoryRef.current
    ) {
      return;
    }

    const node = historyRef.current;
    if (historyAtBottomRef.current && node) {
      const frame = window.requestAnimationFrame(() => {
        node.scrollTo({ behavior: "auto", top: node.scrollHeight });
      });
      return () => window.cancelAnimationFrame(frame);
    }

    const addedCount = [...messageIds].filter(
      (messageId) => !previous.messageIds.has(messageId),
    ).length;
    if (addedCount) {
      const frame = window.requestAnimationFrame(() =>
        setNewMessageCount((count) => count + addedCount),
      );
      return () => window.cancelAnimationFrame(frame);
    }
  }, [activeConversation?.id, currentUserId, historyVisible, timeline]);

  useLayoutEffect(() => {
    const anchor = historyScrollAnchorRef.current;
    const node = historyRef.current;
    if (!anchor || !node) return;
    if (anchor.conversationId !== activeConversation?.id) {
      historyScrollAnchorRef.current = null;
      restoringHistoryRef.current = false;
      return;
    }
    historyScrollAnchorRef.current = null;
    const anchorElement = anchor.entryId
      ? Array.from(
          node.querySelectorAll<HTMLElement>(
            "[data-message-id], [data-event-id]",
          ),
        ).find(
          (entry) =>
            entry.dataset.messageId === anchor.entryId ||
            entry.dataset.eventId === anchor.entryId,
        )
      : null;
    if (anchorElement && anchor.entryTop !== undefined) {
      node.scrollTop +=
        anchorElement.getBoundingClientRect().top - anchor.entryTop;
    } else {
      node.scrollTop =
        anchor.scrollTop + (node.scrollHeight - anchor.scrollHeight);
    }
    const timer = window.setTimeout(() => {
      restoringHistoryRef.current = false;
    }, 0);
    return () => window.clearTimeout(timer);
  }, [activeConversation?.id, historyAnchorVersion]);

  useEffect(() => {
    if (!highlightedMessageId) return;
    const target = messageRefs.current[highlightedMessageId];
    if (!target) return;
    target.scrollIntoView({
      behavior: prefersReducedMotion() ? "auto" : "smooth",
      block: "center",
    });
    historyPositionedRef.current = true;
    setHistoryPositioned(true);
    const timeout = window.setTimeout(() => setHighlightedMessageId(""), 2200);
    return () => window.clearTimeout(timeout);
  }, [highlightedMessageId, timeline.length]);

  useEffect(() => {
    if (
      !activeConversation?.id ||
      activatedConversationId !== activeConversation.id ||
      !latestEntryId ||
      !latestEntryKind ||
      !documentVisible ||
      document.visibilityState !== "visible" ||
      !historyAtBottom ||
      !historyPositioned ||
      detailsOpen ||
      highlightedMessageId ||
      (isMobileViewport && !mobileDetailOpen)
    ) {
      return;
    }
    let stopped = false;
    let retryTimer: number | null = null;
    let retryCount = 0;
    const markRead = async () => {
      try {
        const result = await markConversationReadAction(
          activeConversation.id,
          latestEntryId,
          latestEntryKind,
        );
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
  }, [
    activatedConversationId,
    activeConversation?.id,
    documentVisible,
    detailsOpen,
    highlightedMessageId,
    historyAtBottom,
    historyPositioned,
    isMobileViewport,
    latestEntryId,
    latestEntryKind,
    mobileDetailOpen,
  ]);

  const openMobileConversation = async (conversationId: string) => {
    const requestId = ++conversationOpenRequestRef.current;
    if (!fullHistoryConversationIdsRef.current.has(conversationId)) {
      try {
        const response = await fetch(
          `/api/messages/sync?conversationId=${encodeURIComponent(conversationId)}`,
          { cache: "no-store" },
        );
        if (requestId !== conversationOpenRequestRef.current) return;
        if (!response.ok) {
          setSyncedConversations((current) =>
            current.filter(
              (conversation) => conversation.id !== conversationId,
            ),
          );
          return;
        }
        const incoming = parseConversationStreamEnvelope(await response.json());
        if (requestId !== conversationOpenRequestRef.current) return;
        if (
          !incoming ||
          !incoming.conversations.some(
            (conversation) => conversation.id === conversationId,
          )
        ) {
          setSyncedConversations((current) =>
            current.filter(
              (conversation) => conversation.id !== conversationId,
            ),
          );
          return;
        }
        fullHistoryConversationIdsRef.current.add(conversationId);
        if (incoming.mutationCursor) {
          mutationCursorsRef.current[conversationId] = incoming.mutationCursor;
        }
        if (incoming.conversationList) {
          setOlderConversationCursor(incoming.conversationList.nextCursor);
        }
        setSyncedConversations((current) =>
          mergeWorkspaceConversationSnapshots(
            current,
            incoming.conversations,
            incoming.messageMutations,
            activeIdRef.current,
            incoming.conversationList,
            highlightMessageId,
            highlightEventId,
          ),
        );
      } catch {
        if (requestId !== conversationOpenRequestRef.current) return;
        toast({
          description: "Please try again.",
          title: "Unable to open this conversation",
          tone: "error",
        });
        return;
      }
    }

    if (requestId !== conversationOpenRequestRef.current) return;

    setSyncedConversations((current) =>
      current.map((conversation) =>
        conversation.id === conversationId
          ? conversation
          : {
              ...conversation,
              events: conversation.events?.slice(-1),
              messages: conversation.messages.slice(-1),
            },
      ),
    );
    setOpenActionMenuMessageId("");
    setDealOfferOpen(false);
    pendingLatestPositionRef.current = conversationId;
    historyPositionedRef.current = false;
    historyAtBottomRef.current = false;
    setHistoryPositioned(false);
    setHistoryAtBottom(false);
    setNewMessageCount(0);
    setDetailsOpen(false);
    setReplyTarget(null);
    setSendError("");
    setActivatedConversationId(conversationId);
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
      window.requestAnimationFrame(() =>
        conversationHeaderRef.current?.focus(),
      );
    }
  };

  const closeMobileConversation = () => {
    conversationOpenRequestRef.current += 1;
    setOpenActionMenuMessageId("");
    setDetailsOpen(false);
    setActivatedConversationId("");
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
    if (
      activeConversation.dealOffer &&
      isDealComposerTrigger(draft) &&
      !isComposingRef.current
    ) {
      setDealOfferOpen(true);
      return;
    }

    const body = draft.trim();
    const conversationId = activeConversation.id;
    const messageId = `local-${Date.now()}`;
    const originalReplyTarget = replyTarget;
    const localReply = originalReplyTarget
      ? toReplyPreview(originalReplyTarget)
      : null;
    setSendError("");
    pendingLatestPositionRef.current = conversationId;
    historyPositionedRef.current = false;
    historyAtBottomRef.current = false;
    setHistoryPositioned(false);
    setHistoryAtBottom(false);
    setActivatedConversationId(conversationId);

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
      let result: Awaited<ReturnType<typeof sendMessageAction>>;
      try {
        result = await sendMessageAction(
          conversationId,
          body,
          localReply?.id ?? null,
        );
      } catch {
        result = { error: "Unable to send this message. Please try again." };
      }
      if (result.error) {
        setLocalMessages((value) => ({
          ...value,
          [conversationId]: (value[conversationId] ?? []).filter(
            (m) => m.id !== messageId,
          ),
        }));
        setDrafts((value) => {
          if (value[conversationId]?.trim()) return value;
          persistDraft(draftStorageKey, conversationId, body);
          return { ...value, [conversationId]: body };
        });
        if (activeIdRef.current === conversationId) {
          setReplyTarget(originalReplyTarget);
          setSendError(result.error);
        } else {
          toast({
            description: result.error,
            title: "Message not sent",
            tone: "error",
          });
        }
      } else {
        setLocalMessages((value) => ({
          ...value,
          [conversationId]: (value[conversationId] ?? []).filter(
            (m) => m.id !== messageId,
          ),
        }));
        toast({ title: "Message sent", tone: "success" });
        window.dispatchEvent(new Event("perx-unread-refresh"));
      }
    });
  };

  const startEditing = (message: WorkspaceMessage) => {
    setEditingMessageId(message.id);
    setEditDraft(message.body);
    setEditError("");
  };

  const startReply = (message: WorkspaceMessage) => {
    setReplyTarget(message);
    composerRef.current?.focus();
  };

  const addSubmittedProposalEvent = (
    conversationEvent: WorkspaceConversationEvent,
  ) => {
    const conversationId = activeConversation?.id;
    if (!conversationId) return;
    setSyncedConversations((current) =>
      current.map((conversation) =>
        conversation.id === conversationId
          ? {
              ...conversation,
              dealOffer: undefined,
              events: mergeWorkspaceEvents(conversation.events, [
                conversationEvent,
              ]),
              lastMessage: "Proposal version submitted",
              timestamp: conversationEvent.createdAt,
            }
          : conversation,
      ),
    );
    if (isDealComposerTrigger(draft)) {
      setDrafts((current) => ({ ...current, [conversationId]: "" }));
      persistDraft(draftStorageKey, conversationId, "");
    }
    pendingLatestPositionRef.current = conversationId;
    setHistoryPositioned(false);
    setHistoryAtBottom(false);
    toast({ title: "Proposal submitted", tone: "success" });
  };

  const cancelEditing = () => {
    setEditingMessageId("");
    setEditDraft("");
    setEditError("");
  };

  const saveEdit = (message: WorkspaceMessage) => {
    if (!editDraft.trim() || isEditPending) return;
    startEditTransition(async () => {
      let result: Awaited<ReturnType<typeof editMessageAction>>;
      try {
        result = await editMessageAction(message.id, editDraft);
      } catch {
        result = { error: "Unable to update this message. Please try again." };
      }
      if (editingMessageIdRef.current !== message.id) return;
      if (result.error) {
        setEditError(result.error);
        return;
      }
      const editedAt = new Date().toISOString();
      setSyncedConversations((current) =>
        current.map((conversation) => ({
          ...conversation,
          messages: conversation.messages.map((candidate) =>
            candidate.id === message.id
              ? { ...candidate, body: editDraft.trim(), editedAt }
              : candidate,
          ),
        })),
      );
      cancelEditing();
      toast({ title: "Message updated", tone: "success" });
    });
  };

  const jumpToLatest = () => {
    const node = historyRef.current;
    if (!node) return;
    node.scrollTo({
      behavior: prefersReducedMotion() ? "auto" : "smooth",
      top: node.scrollHeight,
    });
    node.focus({ preventScroll: true });
  };

  const jumpToMessage = (messageId: string) => {
    const target = messageRefs.current[messageId];
    if (!target) {
      toast({
        description: "Refresh the conversation to load more context.",
        title: "Original message is outside the loaded history",
        tone: "error",
      });
      return;
    }
    setHistoryAtBottom(false);
    setHighlightedMessageId(messageId);
  };

  const deleteMessage = async (message: WorkspaceMessage) => {
    const approved = await confirm({
      confirmLabel: "Remove message",
      description:
        "A tombstone will remain in the conversation. The original content is retained for safety, reporting, and audit history.",
      title: "Remove this message for everyone?",
      tone: "danger",
    });
    if (!approved) return;
    let result: Awaited<ReturnType<typeof deleteMessageAction>>;
    try {
      result = await deleteMessageAction(message.id);
    } catch {
      result = { error: "Unable to remove this message. Please try again." };
    }
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
    toast({ title: "Message removed", tone: "success" });
  };

  const removeConversation = async () => {
    if (!activeConversation) return;
    const conversationId = activeConversation.id;
    const approved = await confirm({
      confirmLabel: "Remove chat",
      description:
        "This only hides the chat from your list. It remains available to other participants and can return after a new message.",
      title: "Remove chat from your list?",
      tone: "danger",
    });
    if (!approved) return;
    let result: Awaited<ReturnType<typeof removeConversationForMeAction>>;
    try {
      result = await removeConversationForMeAction(conversationId);
    } catch {
      result = { error: "Unable to remove this chat. Please try again." };
    }
    if (result.error) {
      toast({
        description: result.error,
        title: "Could not remove this chat",
        tone: "error",
      });
      return;
    }
    setSyncedConversations((current) =>
      current.filter((conversation) => conversation.id !== conversationId),
    );
    persistDraft(draftStorageKey, conversationId, "");
    setActivatedConversationId("");
    setActiveId((current) => (current === conversationId ? "" : current));
    setDetailsOpen(false);
    toast({ title: "Chat removed from your list", tone: "success" });
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
                aria-current={active ? "true" : undefined}
                className={`flex w-full min-w-0 items-start gap-3 rounded-2xl p-3 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)] ${
                  active
                    ? "bg-[color:var(--px-primary-soft)] ring-1 ring-[color:var(--px-primary)]/25"
                    : "hover:bg-[color:var(--px-surface-soft)]"
                }`}
                data-conversation-id={conversation.id}
                key={conversation.id}
                onClick={() => void openMobileConversation(conversation.id)}
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
                      {formatConversationTime(
                        conversation.timestamp,
                        useBrowserFormatting,
                      )}
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
          {olderConversationCursor ? (
            <button
              className="mt-3 w-full rounded-xl border border-[color:var(--px-border)] px-3 py-2 text-xs font-black text-[color:var(--px-primary)] transition hover:bg-[color:var(--px-primary-soft)] disabled:cursor-wait disabled:opacity-60"
              disabled={isOlderConversationsPending}
              onClick={loadOlderConversations}
              type="button"
            >
              {isOlderConversationsPending
                ? "Loading older conversations..."
                : "Load older conversations"}
            </button>
          ) : null}
        </div>
      </aside>

      {activeConversation ? (
        <section
          aria-label="Active conversation"
          className={`${mobileDetailOpen ? "flex" : "hidden lg:flex"} relative min-w-0 min-h-0 flex-col bg-[color:var(--px-page)]`}
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
                aria-label={`Open profile preview for ${activeConversation.participantName}`}
                className="flex min-w-0 items-center gap-3 overflow-hidden rounded-xl text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)]"
                onClick={() => setDetailsOpen(true)}
                type="button"
              >
                <Avatar
                  imageUrl={activeConversation.participantImageUrl}
                  name={activeConversation.participantName}
                  presence={activeConversation.participantPresence}
                />
                <span className="min-w-0 overflow-hidden">
                  <span className="block truncate text-sm font-black text-[color:var(--px-text)]">
                    {activeConversation.participantName}
                  </span>
                  <span className="block truncate text-xs text-[color:var(--px-text-muted)]">
                    {presenceLabel(activeConversation.participantPresence) ??
                      activeConversation.participantRole ??
                      activeConversation.opportunityTitle ??
                      "PerX conversation"}
                  </span>
                </span>
              </button>
            </div>
            <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
              {userRoles !== undefined ? (
                <FeatureDirectory
                  closeLabel="Hide app navigation"
                  description="Move around PerX without leaving or reloading this conversation."
                  onOpenChange={preserveHistoryAcrossAppNavigation}
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

          <div className="relative min-h-0 flex-1">
            <div
              aria-label="Message history"
              aria-live="off"
              className="bg-dot-pattern h-full overflow-y-auto overscroll-contain p-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[color:var(--px-focus)] sm:p-4"
              onFocusCapture={() =>
                setActivatedConversationId(activeConversation.id)
              }
              onPointerDown={() =>
                setActivatedConversationId(activeConversation.id)
              }
              ref={historyRef}
              role="log"
              tabIndex={-1}
            >
              <div className="mx-auto flex max-w-3xl flex-col gap-4">
                {activeConversation.olderMessagesCursor ? (
                  <button
                    className="self-center rounded-full border border-[color:var(--px-border)] bg-[color:var(--px-surface)] px-4 py-2 text-xs font-black text-[color:var(--px-primary)] shadow-sm transition hover:bg-[color:var(--px-primary-soft)] disabled:cursor-wait disabled:opacity-60"
                    disabled={isOlderPending}
                    onClick={loadOlderMessages}
                    type="button"
                  >
                    {isOlderPending
                      ? "Loading older messages..."
                      : "Load older messages"}
                  </button>
                ) : null}
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
                    useBrowserFormatting={useBrowserFormatting}
                  />
                ) : null}

                {timeline.map((entry, index) => (
                  <Fragment key={`${entry.kind}:${entry.id}`}>
                    {shouldShowDateSeparator(
                      timeline[index - 1]?.createdAt,
                      entry.createdAt,
                      useBrowserFormatting,
                    ) ? (
                      <DateSeparator
                        useBrowserFormatting={useBrowserFormatting}
                        value={entry.createdAt}
                      />
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
                        onReply={() => startReply(entry.message)}
                        onSaveEdit={saveEdit}
                        onStartEdit={startEditing}
                        onToggleActionMenu={toggleActionMenu}
                        openActionMenu={
                          openActionMenuMessageId === entry.message.id
                        }
                        refCallback={(node) => {
                          messageRefs.current[entry.message.id] = node;
                        }}
                        useBrowserFormatting={useBrowserFormatting}
                      />
                    ) : (
                      <ConversationEventCard
                        event={entry.conversationEvent}
                        highlighted={
                          highlightedMessageId === entry.conversationEvent.id
                        }
                        refCallback={(node) => {
                          messageRefs.current[entry.conversationEvent.id] =
                            node;
                        }}
                        useBrowserFormatting={useBrowserFormatting}
                      />
                    )}
                  </Fragment>
                ))}
              </div>
            </div>
            {historyVisible &&
            historyPositioned &&
            !historyAtBottom &&
            !highlightedMessageId ? (
              <div className="pointer-events-none absolute inset-x-0 bottom-3 z-20 flex justify-center px-3">
                <button
                  aria-label={
                    newMessageCount
                      ? `${newMessageCount} new ${newMessageCount === 1 ? "message" : "messages"}. Jump to latest`
                      : "Jump to latest"
                  }
                  className="pointer-events-auto inline-flex min-h-11 items-center gap-2 rounded-full bg-[color:var(--px-navy)] px-4 text-sm font-black text-white shadow-[var(--px-shadow-strong)] transition hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)] focus-visible:ring-offset-2 motion-reduce:transform-none"
                  onClick={jumpToLatest}
                  type="button"
                >
                  <ArrowDown aria-hidden size={17} />
                  {newMessageCount
                    ? `${newMessageCount} new · Jump to latest`
                    : "Jump to latest"}
                </button>
              </div>
            ) : null}
            <p aria-live="polite" className="sr-only">
              {newMessageCount
                ? `${newMessageCount} new ${newMessageCount === 1 ? "message" : "messages"}`
                : ""}
            </p>
          </div>

          <form
            aria-label="Message composer"
            className="message-composer shrink-0 border-t border-[color:var(--px-border)] bg-[color:var(--px-surface)] p-3"
            onFocusCapture={() =>
              setActivatedConversationId(activeConversation.id)
            }
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
                {activeConversation.dealOffer ? (
                  <button
                    aria-label="Make a Deal"
                    className="inline-flex h-11 shrink-0 items-center gap-2 rounded-xl border border-[color:var(--px-border)] bg-[color:var(--px-surface)] px-3 text-xs font-black text-[color:var(--px-primary)] hover:bg-[color:var(--px-primary-soft)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)]"
                    onClick={() => setDealOfferOpen(true)}
                    type="button"
                  >
                    <Handshake aria-hidden size={17} />
                    <span className="hidden sm:inline">Make a Deal</span>
                  </button>
                ) : null}
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
                  ref={composerRef}
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
                {activeConversation.dealOffer
                  ? " Type @deal to open structured terms."
                  : ""}
              </p>
            </div>
            {sendError ? (
              <p
                className="mx-auto mt-2 max-w-3xl text-sm font-semibold text-[color:var(--px-error)]"
                role="alert"
              >
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
      {activeConversation?.dealOffer && dealOfferOpen ? (
        <ConversationDealOfferDialog
          conversationId={activeConversation.id}
          currency={activeConversation.dealOffer.currency}
          onOpenChange={setDealOfferOpen}
          onSubmitted={addSubmittedProposalEvent}
          open={dealOfferOpen}
          opportunityTitle={activeConversation.dealOffer.opportunityTitle}
          participantName={activeConversation.participantName}
        />
      ) : null}
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
  useBrowserFormatting,
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
  useBrowserFormatting: boolean;
}) {
  const mine = message.senderId === currentUserId;
  const editing = editingMessageId === message.id;
  const isLocal = message.id.startsWith("local-");
  const canEdit =
    mine && !isLocal && !message.deletedAt && message.canMutate !== false;
  const canUseActions = !isLocal && !message.deletedAt;
  const editIsComposingRef = useRef(false);
  const longPressTimerRef = useRef<number | null>(null);
  const longPressStartRef = useRef<{ x: number; y: number } | null>(null);
  const longPressConsumedRef = useRef(false);
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const toast = useToast();

  const copyMessage = useCallback(async () => {
    try {
      if (!navigator.clipboard) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(message.body);
      toast({ title: "Message copied", tone: "success" });
    } catch {
      toast({
        description: "Select the message text and copy it manually.",
        title: "Could not copy message",
        tone: "error",
      });
    }
  }, [message.body, toast]);

  const handleTouchStart = useCallback(
    (event: React.TouchEvent) => {
      const touch = event.touches[0];
      if (!touch || !canUseActions) return;
      if (
        (event.target as HTMLElement).closest(
          "a, button, [role=button], input, textarea, select, summary",
        )
      )
        return;
      longPressConsumedRef.current = false;
      setSwipeOffset(0);
      longPressStartRef.current = { x: touch.clientX, y: touch.clientY };
      longPressTimerRef.current = window.setTimeout(() => {
        longPressTimerRef.current = null;
        longPressConsumedRef.current = true;
        swipeStartRef.current = null;
        setSwipeOffset(0);
        if (!openActionMenu) onToggleActionMenu(message.id);
      }, 500);
      swipeStartRef.current = {
        x: touch.clientX,
        y: touch.clientY,
      };
    },
    [canUseActions, message.id, onToggleActionMenu, openActionMenu],
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
      if (
        swipeStartRef.current &&
        !longPressConsumedRef.current &&
        !mine
      ) {
        const dx = touch.clientX - swipeStartRef.current.x;
        const dy = Math.abs(touch.clientY - swipeStartRef.current.y);
        if (dx > 10 && dx > dy * 1.5) {
          event.preventDefault();
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
    if (!longPressConsumedRef.current && swipeOffset >= 70 && !mine) {
      onReply();
    }
    longPressConsumedRef.current = false;
    setSwipeOffset(0);
    swipeStartRef.current = null;
  }, [swipeOffset, mine, onReply]);

  const handleTouchCancel = useCallback(() => {
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    longPressStartRef.current = null;
    longPressConsumedRef.current = false;
    swipeStartRef.current = null;
    setSwipeOffset(0);
  }, []);

  useEffect(
    () => () => {
      if (longPressTimerRef.current) {
        window.clearTimeout(longPressTimerRef.current);
      }
    },
    [],
  );

  const handleContextMenu = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      if (longPressTimerRef.current) {
        window.clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
      longPressStartRef.current = null;
      longPressConsumedRef.current = true;
      swipeStartRef.current = null;
      setSwipeOffset(0);
      if (!openActionMenu) onToggleActionMenu(message.id);
    },
    [message.id, onToggleActionMenu, openActionMenu],
  );

  return (
    <div
      aria-current={highlighted ? "true" : undefined}
      className={`flex scroll-mt-24 ${mine ? "justify-end" : "justify-start"}`}
      data-message-id={message.id}
      onContextMenu={handleContextMenu}
      onTouchCancel={handleTouchCancel}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchMove}
      onTouchStart={handleTouchStart}
      ref={refCallback}
    >
      <div
        className={`group max-w-[min(82%,42rem)] touch-pan-y overflow-visible rounded-3xl px-4 py-3 shadow-sm transition motion-reduce:transform-none ${
          swipeOffset > 0 ? "relative" : ""
        } ${
          mine
            ? "rounded-br-md bg-[linear-gradient(135deg,var(--px-primary),var(--px-secondary))] text-white"
            : "rounded-bl-md bg-[color:var(--px-surface)] text-[color:var(--px-text)] ring-1 ring-[color:var(--px-border)]"
        } ${highlighted ? "ring-4 ring-[color:var(--px-warning)]" : ""}`}
        style={
          swipeOffset > 0
            ? { transform: `translateX(${Math.round(swipeOffset * 0.35)}px)` }
            : undefined
        }
      >
        <div className="mb-1 flex items-center justify-between gap-3">
          <p
            className={`truncate text-[10px] font-black uppercase tracking-wide ${mine ? "text-blue-100" : "text-[color:var(--px-primary)]"}`}
          >
            {message.senderName}
          </p>
          {canUseActions ? (
            <div className="relative flex items-center gap-1">
              <div
                className={`hidden items-center gap-0.5 rounded-xl bg-[color:var(--px-surface-soft)] p-0.5 opacity-0 transition group-focus-within:opacity-100 group-hover:opacity-100 sm:flex ${
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
                  onClick={() => void copyMessage()}
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
                onCopy={copyMessage}
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
          <span>
            {formatMessageTime(message.createdAt, useBrowserFormatting)}
          </span>
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
  useBrowserFormatting,
}: {
  event: WorkspaceConversationEvent;
  highlighted: boolean;
  refCallback: (node: HTMLDivElement | null) => void;
  useBrowserFormatting: boolean;
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
            {formatMessageTime(event.createdAt, useBrowserFormatting)}
          </span>
        </div>
        <div className="p-4">
          {amountMinor && currency ? (
            <p className="text-xl font-black text-[color:var(--px-text)]">
              {formatMinorMoney(amountMinor, currency, useBrowserFormatting)}
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
            ) : event.proposalHref ? (
              <Link
                className="text-xs font-black text-[color:var(--px-primary)] hover:underline"
                href={event.proposalHref}
              >
                Review proposal
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
  useBrowserFormatting,
}: {
  deal: NonNullable<WorkspaceConversation["deal"]>;
  href?: string;
  useBrowserFormatting: boolean;
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
            {formatMinorMoney(
              deal.amountMinor,
              deal.currency,
              useBrowserFormatting,
            )}
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

function DateSeparator({
  useBrowserFormatting,
  value,
}: {
  useBrowserFormatting: boolean;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 py-1" role="separator">
      <span className="h-px flex-1 bg-[color:var(--px-border)]" />
      <span className="rounded-full bg-[color:var(--px-surface)] px-3 py-1 text-[10px] font-black uppercase tracking-wide text-[color:var(--px-text-muted)] shadow-sm ring-1 ring-[color:var(--px-border)]">
        {formatMessageDay(value, useBrowserFormatting)}
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
  onCopy,
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
  onCopy: () => Promise<void>;
  onClose: () => void;
  onDelete: () => void;
  onReply: () => void;
  onStartEdit: () => void;
  onToggle: () => void;
}) {
  const reportHref = `/app/reports/new?targetType=MESSAGE&targetId=${encodeURIComponent(message.id)}&conversationId=${encodeURIComponent(conversationId)}&messageId=${encodeURIComponent(message.id)}`;

  return (
    <DropdownMenu.Root
      onOpenChange={(open) => {
        if (open && !isOpen) onToggle();
        if (!open && isOpen) onClose();
      }}
      open={isOpen}
    >
      <DropdownMenu.Trigger asChild>
        <button
          aria-label="Message actions"
          className={`grid h-11 w-11 shrink-0 place-items-center rounded-full focus:outline-none focus-visible:ring-2 ${
            mine
              ? "text-blue-100 hover:bg-white/10 focus-visible:ring-white"
              : "text-[color:var(--px-text-muted)] hover:bg-[color:var(--px-muted)] focus-visible:ring-[color:var(--px-focus)]"
          }`}
          type="button"
        >
          <MoreVertical aria-hidden size={15} />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          className="z-[95] grid min-w-40 gap-1 rounded-xl border border-[color:var(--px-border)] bg-[color:var(--px-surface)] p-1 text-[color:var(--px-text)] shadow-lg"
          sideOffset={4}
        >
          <DropdownMenu.Item asChild>
            <button
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-bold outline-none hover:bg-[color:var(--px-muted)] focus:bg-[color:var(--px-muted)]"
              onClick={onReply}
              type="button"
            >
              <Reply aria-hidden size={14} />
              Reply
            </button>
          </DropdownMenu.Item>
          <DropdownMenu.Item asChild>
            <button
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-bold outline-none hover:bg-[color:var(--px-muted)] focus:bg-[color:var(--px-muted)]"
              onClick={() => void onCopy()}
              type="button"
            >
              <Copy aria-hidden size={14} />
              Copy
            </button>
          </DropdownMenu.Item>
          {canEdit ? (
            <DropdownMenu.Item asChild>
              <button
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-bold outline-none hover:bg-[color:var(--px-muted)] focus:bg-[color:var(--px-muted)]"
                onClick={onStartEdit}
                type="button"
              >
                <Pencil aria-hidden size={14} />
                Edit
              </button>
            </DropdownMenu.Item>
          ) : null}
          {canEdit ? (
            <DropdownMenu.Item asChild>
              <button
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-bold text-[color:var(--px-error)] outline-none hover:bg-red-50 focus:bg-red-50 dark:hover:bg-red-950/30 dark:focus:bg-red-950/30"
                onClick={onDelete}
                type="button"
              >
                <Trash2 aria-hidden size={14} />
                Remove message
              </button>
            </DropdownMenu.Item>
          ) : null}
          {!mine && !message.id.startsWith("local-") ? (
            <DropdownMenu.Item asChild>
              <Link
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-bold outline-none hover:bg-[color:var(--px-muted)] focus:bg-[color:var(--px-muted)]"
                href={reportHref}
              >
                <Flag aria-hidden size={14} />
                Report
              </Link>
            </DropdownMenu.Item>
          ) : null}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
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

  return (
    <>
      <aside className="hidden min-h-0 border-l border-[color:var(--px-border)] 2xl:flex">
        <ConversationDetailsContent
          conversation={conversation}
          modal={false}
          onRemove={onRemove}
        />
      </aside>
      <Dialog.Root
        onOpenChange={(nextOpen) => {
          if (!nextOpen) onClose();
        }}
        open={open}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[80] bg-[color:var(--px-overlay)] backdrop-blur-[2px]" />
          <Dialog.Content className="fixed inset-0 z-[81] flex h-dvh min-h-0 w-full flex-col bg-[color:var(--px-surface)] shadow-[var(--px-shadow-strong)] focus:outline-none sm:left-auto sm:right-0 sm:w-[min(28rem,100vw)]">
            <Dialog.Description className="sr-only">
              Profile and conversation actions for{" "}
              {conversation.participantName}.
            </Dialog.Description>
            <ConversationDetailsContent
              conversation={conversation}
              key={conversation.id}
              modal
              onRemove={onRemove}
            />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}

function ConversationDetailsContent({
  conversation,
  modal,
  onRemove,
}: {
  conversation: WorkspaceConversation;
  modal: boolean;
  onRemove: () => void;
}) {
  const profileHref = conversation.participantUsername
    ? `/u/${conversation.participantUsername}`
    : null;

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-[color:var(--px-surface)]">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[color:var(--px-border)] px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        {modal ? (
          <Dialog.Title className="font-black text-[color:var(--px-text)]">
            Profile preview
          </Dialog.Title>
        ) : (
          <h3 className="font-black text-[color:var(--px-text)]">
            Profile preview
          </h3>
        )}
        <div className="flex items-center gap-1">
          {profileHref ? (
            <Link
              className="inline-flex min-h-10 items-center rounded-lg px-3 text-xs font-black text-[color:var(--px-primary)] transition hover:bg-[color:var(--px-primary-soft)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)]"
              href={profileHref}
            >
              Full profile
            </Link>
          ) : null}
          {modal ? (
            <Dialog.Close asChild>
              <button
                aria-label="Close profile preview"
                className="grid h-11 w-11 place-items-center rounded-full text-[color:var(--px-text-muted)] hover:bg-[color:var(--px-muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)]"
                type="button"
              >
                <X aria-hidden size={18} />
              </button>
            </Dialog.Close>
          ) : null}
        </div>
      </div>

      <div
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4"
        data-profile-preview-scroll="true"
      >
        <div className="grid gap-4">
          <div className="rounded-3xl bg-[color:var(--px-surface-soft)] p-5 text-center ring-1 ring-[color:var(--px-border)]">
            <Avatar
              imageUrl={conversation.participantImageUrl}
              name={conversation.participantName}
              presence={conversation.participantPresence}
              size="lg"
            />
            <h3 className="mt-3 break-words font-black text-[color:var(--px-text)]">
              {conversation.participantName}
            </h3>
            <p className="break-all text-xs text-[color:var(--px-text-muted)]">
              @{conversation.participantUsername ?? "perx-member"}
            </p>
            <p className="mt-2 text-sm leading-6 text-[color:var(--px-text-muted)]">
              {presenceLabel(conversation.participantPresence) ??
                conversation.participantRole ??
                "PerX member"}
            </p>
            {profileHref ? (
              <Link
                className="mt-4 inline-flex min-h-11 items-center rounded-[var(--px-radius-sm)] bg-[color:var(--px-primary)] px-4 text-sm font-bold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)]"
                href={profileHref}
              >
                Open complete profile
              </Link>
            ) : null}
            {conversation.participantProfile ? (
              <div className="mt-4 border-t border-[color:var(--px-border)] pt-4 text-left">
                <p className="text-sm font-black text-[color:var(--px-text)]">
                  {conversation.participantProfile.headline}
                </p>
                {conversation.participantProfile.location ? (
                  <p className="mt-1 text-xs font-semibold text-[color:var(--px-text-muted)]">
                    {conversation.participantProfile.location}
                  </p>
                ) : null}
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[color:var(--px-text-muted)]">
                  {conversation.participantProfile.biography}
                </p>
                {conversation.participantProfile.skills.length ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {conversation.participantProfile.skills.map((skill) => (
                      <span
                        className="rounded-full bg-[color:var(--px-surface)] px-2.5 py-1 text-xs font-bold text-[color:var(--px-text-muted)]"
                        key={skill}
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
            {conversation.participantId ? (
              <div className="mt-3 flex flex-col gap-2">
                <Link
                  className="inline-flex min-h-11 items-center justify-center rounded-[var(--px-radius-sm)] border border-[color:var(--px-border-strong)] px-4 text-sm font-bold text-[color:var(--px-text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)]"
                  href={`/app/reports/new?targetType=USER&targetId=${encodeURIComponent(
                    conversation.participantId,
                  )}`}
                >
                  Report profile
                </Link>
                <form
                  action={blockUserAction.bind(
                    null,
                    conversation.participantId,
                  )}
                >
                  <button
                    className="inline-flex min-h-11 w-full items-center justify-center rounded-[var(--px-radius-sm)] border border-red-200 px-4 text-sm font-bold text-red-700 transition hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:hover:bg-red-950/30"
                    type="submit"
                  >
                    Block member
                  </button>
                </form>
              </div>
            ) : null}
          </div>

          <div className="rounded-3xl bg-[color:var(--px-surface-soft)] p-4 ring-1 ring-[color:var(--px-border)]">
            <h3 className="font-bold text-[color:var(--px-text)]">
              Conversation context
            </h3>
            <p className="mt-2 text-sm leading-6 text-[color:var(--px-text-muted)]">
              {conversation.opportunityTitle ??
                conversation.context ??
                "Professional conversation"}
            </p>
            {conversation.dealHref ? (
              <Link
                className="mt-3 inline-flex min-h-11 items-center rounded-[var(--px-radius-sm)] bg-[color:var(--px-primary)] px-4 text-sm font-bold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)]"
                href={conversation.dealHref}
              >
                Open linked deal
              </Link>
            ) : (
              <p className="mt-3 rounded-[var(--px-radius-sm)] bg-[color:var(--px-surface)] p-3 text-sm font-semibold text-[color:var(--px-text-muted)]">
                No deal is linked to this conversation.
              </p>
            )}
          </div>

          <div
            className="rounded-3xl border border-[color:var(--px-border)] bg-[color:var(--px-surface)] p-4"
            data-profile-preview-end="true"
          >
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[color:var(--px-muted)] text-[color:var(--px-text-muted)]">
                <UserRoundX aria-hidden size={18} />
              </span>
              <div>
                <h3 className="text-sm font-black text-[color:var(--px-text)]">
                  Your chat list
                </h3>
                <p className="mt-1 text-xs leading-5 text-[color:var(--px-text-muted)]">
                  Removing this chat only hides it for you. Messages, deal
                  records, reports, and the other participant&apos;s copy
                  remain.
                </p>
              </div>
            </div>
            <button
              className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-[color:var(--px-border-strong)] px-4 text-sm font-bold text-[color:var(--px-text)] transition hover:bg-[color:var(--px-muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)]"
              onClick={onRemove}
              type="button"
            >
              Remove chat for me
            </button>
          </div>
        </div>
      </div>
    </div>
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

function mergeWorkspaceConversationSnapshots(
  current: WorkspaceConversation[],
  incoming: WorkspaceConversation[],
  messageMutations: WorkspaceMessageMutation[],
  activeConversationId: string,
  conversationList: WorkspaceConversationListSnapshot | null,
  highlightMessageId?: string,
  highlightEventId?: string,
) {
  const authoritativeIds = conversationList
    ? new Set(conversationList.ids)
    : null;
  const retainedCurrent = authoritativeIds
    ? current.filter(
        (conversation) =>
          authoritativeIds.has(conversation.id) ||
          conversation.id === activeConversationId,
      )
    : current;
  const incomingById = new Map(
    incoming.map((conversation) => [conversation.id, conversation]),
  );
  const merged = retainedCurrent.map((conversation) => {
    const next = incomingById.get(conversation.id);
    if (!next) return conversation;
    const mergedMessages = mergeWorkspaceMessages(
      conversation.messages,
      next.messages,
    );
    const mergedEvents = mergeWorkspaceEvents(conversation.events, next.events);
    if (!highlightMessageId && !highlightEventId) {
      return {
        ...next,
        events: mergedEvents,
        historyLoaded:
          conversation.historyLoaded === true || next.historyLoaded === true,
        messages: mergedMessages,
        olderMessagesCursor:
          conversation.olderMessagesCursor === undefined
            ? next.olderMessagesCursor
            : conversation.olderMessagesCursor,
      };
    }
    const target = conversation.messages.find(
      (message) => message.id === highlightMessageId,
    );
    const targetEvent = conversation.events?.find(
      (event) => event.id === highlightEventId,
    );
    if (target && !mergedMessages.some((message) => message.id === target.id)) {
      mergedMessages.push(target);
    }
    if (
      targetEvent &&
      !mergedEvents.some((event) => event.id === targetEvent.id)
    ) {
      mergedEvents.push(targetEvent);
    }
    return {
      ...next,
      events: mergeWorkspaceEvents(undefined, mergedEvents),
      historyLoaded:
        conversation.historyLoaded === true || next.historyLoaded === true,
      messages: mergeWorkspaceMessages([], mergedMessages),
      olderMessagesCursor:
        conversation.olderMessagesCursor === undefined
          ? next.olderMessagesCursor
          : conversation.olderMessagesCursor,
    };
  });
  for (const conversation of incoming) {
    if (
      !retainedCurrent.some((candidate) => candidate.id === conversation.id)
    ) {
      merged.push(conversation);
    }
  }
  return sortWorkspaceConversations(
    applyWorkspaceMessageMutations(merged, messageMutations),
  );
}

function sortWorkspaceConversations(conversations: WorkspaceConversation[]) {
  return [...conversations].sort((left, right) => {
    const leftTimestamp = Date.parse(left.timestamp ?? "");
    const rightTimestamp = Date.parse(right.timestamp ?? "");
    if (Number.isFinite(leftTimestamp) && Number.isFinite(rightTimestamp)) {
      return rightTimestamp - leftTimestamp || right.id.localeCompare(left.id);
    }
    if (Number.isFinite(leftTimestamp)) return -1;
    if (Number.isFinite(rightTimestamp)) return 1;
    return 0;
  });
}

function applyWorkspaceMessageMutations(
  conversations: WorkspaceConversation[],
  mutations: WorkspaceMessageMutation[],
) {
  if (!mutations.length) return conversations;
  const mutationsByConversation = new Map<
    string,
    Map<string, WorkspaceMessageMutation>
  >();
  for (const mutation of mutations) {
    const byMessage =
      mutationsByConversation.get(mutation.conversationId) ??
      new Map<string, WorkspaceMessageMutation>();
    byMessage.set(mutation.id, mutation);
    mutationsByConversation.set(mutation.conversationId, byMessage);
  }

  return conversations.map((conversation) => {
    const byMessage = mutationsByConversation.get(conversation.id);
    if (!byMessage) return conversation;
    return {
      ...conversation,
      messages: conversation.messages.map((message) => {
        const mutation = byMessage.get(message.id);
        const replyMutation = message.replyTo
          ? byMessage.get(message.replyTo.id)
          : undefined;
        return {
          ...message,
          ...(mutation
            ? {
                body: mutation.body,
                deletedAt: mutation.deletedAt,
                editedAt: mutation.editedAt,
              }
            : {}),
          replyTo:
            message.replyTo && replyMutation
              ? {
                  ...message.replyTo,
                  body: replyMutation.body,
                  deletedAt: replyMutation.deletedAt,
                }
              : message.replyTo,
        };
      }),
    };
  });
}

function mergeWorkspaceMessages(
  current: WorkspaceMessage[],
  incoming: WorkspaceMessage[],
) {
  const byId = new Map(current.map((message) => [message.id, message]));
  for (const message of incoming) byId.set(message.id, message);

  return [...byId.values()].sort((left, right) => {
    const timeDifference =
      new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
    return timeDifference || left.id.localeCompare(right.id);
  });
}

function mergeWorkspaceEvents(
  current: WorkspaceConversationEvent[] | undefined,
  incoming: WorkspaceConversationEvent[] | undefined,
) {
  const byId = new Map(
    (current ?? []).map((conversationEvent) => [
      conversationEvent.id,
      conversationEvent,
    ]),
  );
  for (const conversationEvent of incoming ?? []) {
    byId.set(conversationEvent.id, conversationEvent);
  }

  return [...byId.values()].sort((left, right) => {
    const timeDifference =
      new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
    return timeDifference || left.id.localeCompare(right.id);
  });
}

function parseConversationStreamEnvelope(value: unknown): {
  conversationList: WorkspaceConversationListSnapshot | null;
  conversations: WorkspaceConversation[];
  messageMutations: WorkspaceMessageMutation[];
  mutationCursor: string | null;
} | null {
  const conversations = parseConversationEnvelope(value);
  if (!conversations || !value || typeof value !== "object") return null;
  const payload = value as {
    conversationList?: unknown;
    messageMutations?: unknown;
    mutationCursor?: unknown;
  };
  if (
    payload.messageMutations !== undefined &&
    !Array.isArray(payload.messageMutations)
  ) {
    return null;
  }
  let conversationList: WorkspaceConversationListSnapshot | null = null;
  if (
    payload.conversationList !== undefined &&
    payload.conversationList !== null
  ) {
    if (
      typeof payload.conversationList !== "object" ||
      Array.isArray(payload.conversationList)
    ) {
      return null;
    }
    const candidate = payload.conversationList as {
      ids?: unknown;
      nextCursor?: unknown;
    };
    if (
      !Array.isArray(candidate.ids) ||
      candidate.ids.length > 50 ||
      !candidate.ids.every((id) => typeof id === "string") ||
      !(
        candidate.nextCursor === null ||
        typeof candidate.nextCursor === "string"
      )
    ) {
      return null;
    }
    conversationList = {
      ids: candidate.ids,
      nextCursor: candidate.nextCursor,
    };
  }
  const messageMutations = (payload.messageMutations ?? []).flatMap(
    (candidate): WorkspaceMessageMutation[] => {
      if (
        !candidate ||
        typeof candidate !== "object" ||
        Array.isArray(candidate)
      ) {
        return [];
      }
      const mutation = candidate as Partial<WorkspaceMessageMutation>;
      if (
        typeof mutation.id !== "string" ||
        typeof mutation.conversationId !== "string" ||
        typeof mutation.body !== "string" ||
        !(
          mutation.deletedAt === null || typeof mutation.deletedAt === "string"
        ) ||
        !(mutation.editedAt === null || typeof mutation.editedAt === "string")
      ) {
        return [];
      }
      return [mutation as WorkspaceMessageMutation];
    },
  );

  return {
    conversationList,
    conversations,
    messageMutations,
    mutationCursor:
      typeof payload.mutationCursor === "string"
        ? payload.mutationCursor
        : null,
  };
}

function parseMessagePageEnvelope(value: unknown): {
  items: WorkspaceMessage[];
  nextCursor: string | null;
} | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const payload = value as { items?: unknown; nextCursor?: unknown };
  if (!Array.isArray(payload.items)) return null;

  const items = payload.items.flatMap((candidate) => {
    if (
      !candidate ||
      typeof candidate !== "object" ||
      Array.isArray(candidate)
    ) {
      return [];
    }
    const message = candidate as Partial<WorkspaceMessage>;
    if (
      typeof message.id !== "string" ||
      typeof message.body !== "string" ||
      typeof message.createdAt !== "string" ||
      typeof message.senderId !== "string" ||
      typeof message.senderName !== "string"
    ) {
      return [];
    }
    return [message as WorkspaceMessage];
  });

  return {
    items,
    nextCursor:
      typeof payload.nextCursor === "string" ? payload.nextCursor : null,
  };
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

function parseConversationPageEnvelope(value: unknown): {
  items: WorkspaceConversation[];
  nextCursor: string | null;
} | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const payload = value as { conversations?: unknown; nextCursor?: unknown };
  const items = parseConversationEnvelope(value);
  if (!Array.isArray(payload.conversations) || !items) return null;

  return {
    items,
    nextCursor:
      typeof payload.nextCursor === "string" ? payload.nextCursor : null,
  };
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

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function formatMessageTime(
  value: string | undefined,
  useBrowserFormatting: boolean,
) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(useBrowserFormatting ? undefined : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: useBrowserFormatting ? undefined : "UTC",
  }).format(date);
}

function formatConversationTime(
  value: string | undefined,
  useBrowserFormatting: boolean,
) {
  if (!value) return "new";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  if (!useBrowserFormatting) {
    return new Intl.DateTimeFormat("en-US", {
      day: "2-digit",
      month: "short",
      timeZone: "UTC",
    }).format(date);
  }

  const now = new Date();
  const today = getCalendarDayStart(now, true);
  const thatDay = getCalendarDayStart(date, true);
  const dayDiff = Math.round((today - thatDay) / 86_400_000);

  if (dayDiff === 0) return formatMessageTime(value, true);
  if (dayDiff === 1) return "Yesterday";
  return new Intl.DateTimeFormat(undefined, {
    day: "2-digit",
    month: "short",
  }).format(date);
}

function shouldShowDateSeparator(
  previous: string | undefined,
  current: string,
  useBrowserFormatting: boolean,
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
  return (
    getCalendarDayStart(previousDate, useBrowserFormatting) !==
    getCalendarDayStart(currentDate, useBrowserFormatting)
  );
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

function formatMessageDay(value: string, useBrowserFormatting: boolean) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Conversation";
  if (!useBrowserFormatting) {
    return new Intl.DateTimeFormat("en-US", {
      day: "numeric",
      month: "short",
      timeZone: "UTC",
      year: "numeric",
    }).format(date);
  }

  const now = new Date();
  const today = getCalendarDayStart(now, true);
  const messageDay = getCalendarDayStart(date, true);
  const dayDiff = Math.round((today - messageDay) / 86_400_000);
  if (dayDiff === 0) return "Today";
  if (dayDiff === 1) return "Yesterday";
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: date.getFullYear() === now.getFullYear() ? undefined : "numeric",
  }).format(date);
}

function getCalendarDayStart(date: Date, useBrowserFormatting: boolean) {
  if (!useBrowserFormatting) {
    return Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
    );
  }
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  ).getTime();
}

function formatMinorMoney(
  value: string,
  currency: string,
  useBrowserFormatting: boolean,
) {
  try {
    const amount = Number(BigInt(value)) / 100;
    return new Intl.NumberFormat(useBrowserFormatting ? undefined : "en-US", {
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
