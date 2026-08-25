import {
  getCurrentUser,
  validateCurrentSessionAccess,
} from "@/lib/auth/session";
import { parseMessageRouteId } from "@/lib/messages/entry";
import {
  createMessageMutationBaseline,
  getMessageMutationsAfter,
  validateMessageMutationCursor,
} from "@/lib/messages/mutations";
import {
  hasConversationRealtimeAccess,
  subscribeToConversationRealtime,
  type ConversationRealtimeChange,
  type ConversationRealtimeSubscription,
} from "@/lib/messages/realtime";
import { getRealtimeWorkspaceMessage } from "@/lib/messages/realtime-message";
import { getMessageSnapshot } from "@/lib/messages/snapshot";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const keepAliveIntervalMs = 15_000;
const accessValidationIntervalMs = 30_000;
const reconciliationIntervalMs = 60_000;
const realtimeRetryMaxMs = 60_000;
const realtimeRetryInitialMs = 5_000;
const changeDebounceMs = 50;
const maxMutationPagesPerReconciliation = 4;

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json(
      { error: "Authentication required." },
      { status: 401 },
    );
  }

  const url = new URL(request.url);
  const rawConversationId = url.searchParams.get("conversationId");
  const conversationId = rawConversationId
    ? parseMessageRouteId(rawConversationId)
    : null;
  if (rawConversationId && !conversationId) {
    return Response.json({ error: "Invalid conversation." }, { status: 400 });
  }
  if (
    conversationId &&
    !(await hasConversationRealtimeAccess(conversationId, user.id))
  ) {
    return Response.json({ error: "Not found." }, { status: 404 });
  }

  const requestedMutationCursor = conversationId
    ? (request.headers.get("last-event-id") ??
      url.searchParams.get("mutationCursor"))
    : null;
  let initialMutationCursor = conversationId
    ? createMessageMutationBaseline(user.id, conversationId)
    : null;
  if (requestedMutationCursor && conversationId) {
    try {
      validateMessageMutationCursor(
        requestedMutationCursor,
        user.id,
        conversationId,
      );
      initialMutationCursor = requestedMutationCursor;
    } catch {
      return Response.json({ error: "Invalid cursor." }, { status: 400 });
    }
  }

  const encoder = new TextEncoder();
  let closeStream = () => {};
  const stream = new ReadableStream({
    start(controller) {
      let closed = false;
      let realtime: ConversationRealtimeSubscription | null = null;
      let realtimeGeneration = 0;
      let realtimeStart: Promise<void> | null = null;
      let realtimeRetryMs = realtimeRetryInitialMs;
      let realtimeRetry: ReturnType<typeof setTimeout> | null = null;
      let keepAlive: ReturnType<typeof setInterval> | null = null;
      let accessValidation: ReturnType<typeof setInterval> | null = null;
      let reconciliation: ReturnType<typeof setInterval> | null = null;
      let changeTimer: ReturnType<typeof setTimeout> | null = null;
      let changeIncludesConversationList = false;
      let realtimeRestartTimer: ReturnType<typeof setTimeout> | null = null;
      let reconciliationInFlight = false;
      let pendingReconciliation = false;
      let pendingReconciliationIncludeList = false;
      let accessValidationInFlight = false;
      let mutationCursor = initialMutationCursor;
      const messageChangeVersions = new Map<string, number>();

      const enqueue = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          close();
        }
      };
      const sendEvent = (event: string, data: unknown, id?: string | null) => {
        enqueue(
          `${id ? `id: ${id}\n` : ""}event: ${event}\ndata: ${JSON.stringify(data)}\n\n`,
        );
      };
      const close = () => {
        if (closed) return;
        closed = true;
        if (realtimeRetry) clearTimeout(realtimeRetry);
        if (keepAlive) clearInterval(keepAlive);
        if (accessValidation) clearInterval(accessValidation);
        if (reconciliation) clearInterval(reconciliation);
        if (changeTimer) clearTimeout(changeTimer);
        if (realtimeRestartTimer) clearTimeout(realtimeRestartTimer);
        realtimeGeneration += 1;
        void realtime?.close();
        realtime = null;
        try {
          controller.close();
        } catch {
          // The browser may have already released the connection.
        }
      };
      closeStream = close;

      const sendReconciliation = async (includeConversationList: boolean) => {
        if (closed) return;
        if (reconciliationInFlight) {
          pendingReconciliation = true;
          pendingReconciliationIncludeList ||= includeConversationList;
          return;
        }
        reconciliationInFlight = true;
        try {
          const snapshot = await getMessageSnapshot({
            conversationId,
            includeConversationList,
            userId: user.id,
            userRoles: user.roles,
          });
          if (closed) return;
          if (snapshot.notFound) {
            sendEvent("unavailable", {});
            close();
            return;
          }

          let mutationPage =
            conversationId && mutationCursor
              ? await getMessageMutationsAfter({
                  conversationId,
                  cursor: mutationCursor,
                  userId: user.id,
                })
              : null;
          if (closed) return;
          if (mutationPage) mutationCursor = mutationPage.checkpoint;
          sendEvent(
            "conversations",
            {
              conversationList: snapshot.conversationList,
              conversations: snapshot.conversations ?? [],
              messageMutations: mutationPage?.items ?? [],
            },
            mutationCursor,
          );
          let mutationPagesLoaded = mutationPage ? 1 : 0;
          while (
            conversationId &&
            mutationPage?.hasMore &&
            mutationCursor &&
            mutationPagesLoaded < maxMutationPagesPerReconciliation
          ) {
            mutationPage = await getMessageMutationsAfter({
              conversationId,
              cursor: mutationCursor,
              userId: user.id,
            });
            if (closed) return;
            mutationCursor = mutationPage.checkpoint;
            mutationPagesLoaded += 1;
            sendEvent(
              "conversations",
              {
                conversationList: null,
                conversations: [],
                messageMutations: mutationPage.items,
              },
              mutationCursor,
            );
          }
          if (mutationPage?.hasMore) pendingReconciliation = true;
        } catch {
          sendEvent("stream-error", {
            message: "Message updates are reconnecting.",
          });
        } finally {
          reconciliationInFlight = false;
          if (pendingReconciliation && !closed) {
            pendingReconciliation = false;
            const includePendingList = pendingReconciliationIncludeList;
            pendingReconciliationIncludeList = false;
            void sendReconciliation(includePendingList);
          }
        }
      };

      const scheduleRealtimeRestart = () => {
        if (closed || realtimeRestartTimer) return;
        realtimeRestartTimer = setTimeout(() => {
          realtimeRestartTimer = null;
          void restartRealtime();
        }, changeDebounceMs);
      };

      const handleRealtimeChange = (change: ConversationRealtimeChange) => {
        if (closed) return;
        if (change.kind === "conversation") {
          if (change.refreshSubscription) scheduleRealtimeRestart();
          changeIncludesConversationList ||= change.includeConversationList;
          if (changeTimer) clearTimeout(changeTimer);
          changeTimer = setTimeout(() => {
            changeTimer = null;
            const includeConversationList = changeIncludesConversationList;
            changeIncludesConversationList = false;
            void sendReconciliation(includeConversationList);
          }, changeDebounceMs);
          return;
        }

        const messageChangeVersion =
          (messageChangeVersions.get(change.messageId) ?? 0) + 1;
        messageChangeVersions.set(change.messageId, messageChangeVersion);
        if (change.eventType === "DELETE") {
          sendEvent("conversation-message", {
            conversationId,
            message: null,
            messageId: change.messageId,
            operation: change.eventType,
          });
          return;
        }

        void getRealtimeWorkspaceMessage({
          conversationId: conversationId!,
          messageId: change.messageId,
          userId: user.id,
        })
          .then((message) => {
            if (
              closed ||
              messageChangeVersions.get(change.messageId) !==
                messageChangeVersion
            ) {
              return;
            }
            if (!message) {
              void sendReconciliation(true);
              return;
            }
            sendEvent("conversation-message", {
              conversationId,
              message,
              messageId: change.messageId,
              operation: change.eventType,
            });
          })
          .catch(() => {
            sendEvent("stream-error", {
              message: "Message updates are reconnecting.",
            });
          });
      };

      const scheduleRealtimeRetry = () => {
        if (closed || realtimeRetry) return;
        realtimeRetry = setTimeout(() => {
          realtimeRetry = null;
          startRealtime();
        }, realtimeRetryMs);
        realtimeRetryMs = Math.min(realtimeRetryMs * 2, realtimeRetryMaxMs);
      };
      const startRealtime = () => {
        if (closed || realtime || realtimeStart) return;
        const generation = ++realtimeGeneration;
        let subscription: ConversationRealtimeSubscription | null = null;
        realtimeStart = subscribeToConversationRealtime({
          conversationId,
          onChange: handleRealtimeChange,
          onStatus: (status) => {
            if (closed || generation !== realtimeGeneration) return;
            if (status === "subscribed") {
              realtimeRetryMs = realtimeRetryInitialMs;
              void sendReconciliation(true);
              return;
            }
            realtimeGeneration += 1;
            if (realtime === subscription) realtime = null;
            sendEvent("stream-error", {
              message: "Message updates are reconnecting.",
            });
            void subscription?.close();
            scheduleRealtimeRetry();
          },
          userId: user.id,
        })
          .then(async (createdSubscription) => {
            subscription = createdSubscription;
            if (closed || generation !== realtimeGeneration) {
              await createdSubscription.close();
              return;
            }
            realtime = createdSubscription;
          })
          .catch(() => {
            if (closed || generation !== realtimeGeneration) return;
            realtimeGeneration += 1;
            sendEvent("stream-error", {
              message: "Message updates are reconnecting.",
            });
            scheduleRealtimeRetry();
          })
          .finally(() => {
            realtimeStart = null;
          });
      };
      const restartRealtime = async () => {
        realtimeGeneration += 1;
        const current = realtime;
        realtime = null;
        await Promise.all([
          current?.close() ?? Promise.resolve(),
          realtimeStart ?? Promise.resolve(),
        ]);
        startRealtime();
      };

      enqueue("retry: 5000\n\n");
      startRealtime();
      keepAlive = setInterval(
        () => enqueue(": keepalive\n\n"),
        keepAliveIntervalMs,
      );
      accessValidation = setInterval(async () => {
        if (closed || accessValidationInFlight) return;
        accessValidationInFlight = true;
        const [sessionValid, conversationValid] = await Promise.all([
          validateCurrentSessionAccess(),
          conversationId
            ? hasConversationRealtimeAccess(conversationId, user.id)
            : Promise.resolve(true),
        ]).catch(() => [false, false]);
        if (!sessionValid || !conversationValid) {
          sendEvent("unavailable", {});
          close();
        }
        accessValidationInFlight = false;
      }, accessValidationIntervalMs);
      reconciliation = setInterval(
        () => void sendReconciliation(true),
        reconciliationIntervalMs,
      );
      request.signal.addEventListener("abort", close, { once: true });
    },
    cancel() {
      closeStream();
    },
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream; charset=utf-8",
      "X-Accel-Buffering": "no",
    },
  });
}
