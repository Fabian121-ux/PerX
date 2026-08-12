import {
  getCurrentUser,
  validateCurrentSessionAccess,
} from "@/lib/auth/session";
import { getMessageSnapshot } from "@/lib/messages/snapshot";
import { parseMessageRouteId } from "@/lib/messages/entry";
import {
  createMessageMutationBaseline,
  getMessageMutationsAfter,
  validateMessageMutationCursor,
} from "@/lib/messages/mutations";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const streamIntervalMs = 2000;
const keepAliveIntervalMs = 15000;
const conversationListRefreshIntervalMs = 10000;
const mutationCheckpointIntervalMs = 60000;

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
  const initialSnapshot = await getMessageSnapshot({
    conversationId,
    userId: user.id,
  });

  if (initialSnapshot.notFound) {
    return Response.json({ error: "Not found." }, { status: 404 });
  }

  const encoder = new TextEncoder();
  let lastSignature = "";

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;
      let interval: ReturnType<typeof setInterval> | null = null;
      let keepAlive: ReturnType<typeof setInterval> | null = null;
      let lastAccessValidationAt = Date.now();
      let accessValid = true;
      let mutationCursor = initialMutationCursor;
      let pendingInitialSnapshot: typeof initialSnapshot | null = initialSnapshot;
      let lastConversationListRefreshAt = 0;
      let lastMutationCheckpointSentAt = 0;
      let snapshotInFlight = false;

      const enqueue = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          closed = true;
        }
      };

      const close = () => {
        closed = true;
        if (interval) clearInterval(interval);
        if (keepAlive) clearInterval(keepAlive);
        try {
          controller.close();
        } catch {
          // The client may already have closed the connection.
        }
      };

      const sendSnapshot = async () => {
        if (closed || snapshotInFlight) return;
        snapshotInFlight = true;
        try {
          if (Date.now() - lastAccessValidationAt >= keepAliveIntervalMs) {
            lastAccessValidationAt = Date.now();
            accessValid = await validateCurrentSessionAccess();
          }
          if (!accessValid) {
            enqueue("event: unavailable\ndata: {}\n\n");
            close();
            return;
          }
          const conversationListRefreshDue =
            lastConversationListRefreshAt === 0 ||
            Date.now() - lastConversationListRefreshAt >=
              conversationListRefreshIntervalMs;
          const includeConversationList =
            !conversationId || conversationListRefreshDue;
          const snapshot = pendingInitialSnapshot
            ? pendingInitialSnapshot
            : await getMessageSnapshot({
                conversationId,
                includeConversationList,
                userId: user.id,
              });
          if (pendingInitialSnapshot) pendingInitialSnapshot = null;
          if (conversationListRefreshDue) {
            lastConversationListRefreshAt = Date.now();
          }
          if (snapshot.notFound) {
            enqueue("event: unavailable\ndata: {}\n\n");
            close();
            return;
          }

          const conversations = snapshot.conversations ?? [];
          const previousMutationCursor = mutationCursor;
          const mutationPage =
            conversationId && mutationCursor
              ? await getMessageMutationsAfter({
                  conversationId,
                  cursor: mutationCursor,
                  userId: user.id,
                })
              : null;
          if (mutationPage) mutationCursor = mutationPage.checkpoint;
          const signature = JSON.stringify(
            conversations.map((conversation) => [
              conversation.id,
              conversation.timestamp,
              conversation.unreadCount,
              conversation.messages.map((message) => [
                message.id,
                message.deletedAt,
                message.editedAt,
                message.readByOtherParticipants,
                message.replyTo?.id ?? null,
                message.replyTo?.deletedAt ?? null,
              ]),
            ]),
          );

          if (
            conversationListRefreshDue ||
            signature !== lastSignature ||
            Boolean(mutationPage?.items.length)
          ) {
            lastSignature = signature;
            lastMutationCheckpointSentAt = Date.now();
            enqueue(
              `${mutationCursor ? `id: ${mutationCursor}\n` : ""}event: conversations\ndata: ${JSON.stringify({
                conversationList: snapshot.conversationList,
                conversations,
                messageMutations: mutationPage?.items ?? [],
              })}\n\n`,
            );
          } else if (
            mutationCursor &&
            mutationCursor !== previousMutationCursor &&
            Date.now() - lastMutationCheckpointSentAt >=
              mutationCheckpointIntervalMs
          ) {
            lastMutationCheckpointSentAt = Date.now();
            enqueue(
              `id: ${mutationCursor}\nevent: mutation-checkpoint\ndata: {}\n\n`,
            );
          }
        } catch {
          enqueue(
            `event: stream-error\ndata: ${JSON.stringify({
              message: "Message updates are reconnecting.",
            })}\n\n`,
          );
        } finally {
          snapshotInFlight = false;
        }
      };

      request.signal.addEventListener("abort", close);
      void sendSnapshot();
      interval = setInterval(sendSnapshot, streamIntervalMs);
      keepAlive = setInterval(() => enqueue(": keepalive\n\n"), keepAliveIntervalMs);
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
