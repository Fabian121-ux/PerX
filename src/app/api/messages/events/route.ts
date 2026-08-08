import {
  getCurrentUser,
  validateCurrentSessionAccess,
} from "@/lib/auth/session";
import { getMessageSnapshot } from "@/lib/messages/snapshot";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const streamIntervalMs = 2000;
const keepAliveIntervalMs = 15000;

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json(
      { error: "Authentication required." },
      { status: 401 },
    );
  }

  const url = new URL(request.url);
  const conversationId = url.searchParams.get("conversationId");
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
          const snapshot = await getMessageSnapshot({
            conversationId,
            userId: user.id,
          });
          if (snapshot.notFound) {
            enqueue("event: unavailable\ndata: {}\n\n");
            close();
            return;
          }

          const conversations = snapshot.conversations ?? [];
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

          if (signature !== lastSignature) {
            lastSignature = signature;
            enqueue(
              `event: conversations\ndata: ${JSON.stringify({
                conversations,
              })}\n\n`,
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
