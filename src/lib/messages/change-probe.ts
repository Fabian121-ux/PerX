import { createHash } from "node:crypto";

import { getPrisma } from "@/lib/db/prisma";
import { buildConversationAccessWhere } from "@/lib/messages/access";

/**
 * Lightweight "has anything changed?" probe for degraded (fallback) messaging.
 *
 * Degraded mode previously answered that question by rebuilding the entire
 * snapshot: ~44 queries and ~78 KB per tick, even when nothing had changed.
 * Adaptive backoff reduced how often that happened but not what it cost.
 *
 * ## Why a composite marker
 *
 * `Conversation.updatedAt` looks like an obvious version column, and the send
 * path does bump it. It is not sufficient: message edit and soft-delete
 * (`src/features/messages/actions.ts`) update the `Message` row only, so a
 * marker built solely from `Conversation.updatedAt` reports "unchanged" after a
 * message is removed. That was verified directly against the database before
 * this module was written, and it is exactly the INSERT-only trap that would
 * make degraded mode silently lossy.
 *
 * The marker is therefore a composite over the viewer's authorized set:
 *
 *   - number of authorized conversations  (join, leave, block, archive)
 *   - newest `Conversation.updatedAt`     (new message, conversation activity)
 *   - number of live messages             (insert and hard removal)
 *   - newest `Message.createdAt`          (insert)
 *   - newest `Message.editedAt`           (edit)
 *   - newest `Message.deletedAt`          (soft delete / tombstone)
 *   - newest participant `lastReadAt`     (read-state movement)
 *
 * Every component is server-derived. The client only ever receives an opaque
 * digest, so no client clock and no client-supplied identity participates in
 * the decision.
 *
 * ## Security
 *
 * The viewer id is passed in from the server session by the caller; it is never
 * read from the request. All aggregates are constrained by
 * `buildConversationAccessWhere`, the same predicate the real snapshot uses, so
 * the probe cannot observe (or leak the existence of) a conversation the viewer
 * cannot already see. An unauthorized `conversationId` is reported as
 * `authorized: false` without revealing whether the row exists.
 */

/** Matches the conversation window used by `getMessageSnapshot`. */
const CHANGE_PROBE_CONVERSATION_WINDOW = 51;

export type MessageChangeProbeResult = {
  /** False when the requested conversation is not visible to this viewer. */
  authorized: boolean;
  /** True when the marker differs from the client's `since` value. */
  changed: boolean;
  /** Opaque server-issued marker to send back on the next probe. */
  version: string;
};

function digest(parts: readonly (string | number | null)[]) {
  return createHash("sha256")
    .update(parts.join("|"))
    .digest("base64url")
    .slice(0, 27);
}

function toMillis(value: Date | null | undefined) {
  return value ? value.getTime() : null;
}

/**
 * Computes the current change marker for a viewer, optionally scoped to one
 * conversation.
 *
 * Deliberately aggregate-only: no message bodies, no profile graph, no trust
 * data, no proposals. Aggregates are cheap and, critically, constant in size -
 * the response does not grow with conversation or message count.
 */
export async function getMessageChangeMarker({
  conversationId,
  userId,
}: {
  conversationId: string | null;
  userId: string;
}): Promise<{ authorized: boolean; version: string }> {
  const prisma = getPrisma();
  const accessWhere = buildConversationAccessWhere(userId);

  if (conversationId) {
    // Authorization is resolved through the same access predicate as the
    // snapshot. A miss is indistinguishable from "does not exist".
    const authorized = await prisma.conversation.findFirst({
      select: { id: true, updatedAt: true },
      where: { ...accessWhere, id: conversationId },
    });
    if (!authorized) return { authorized: false, version: "" };

    const [messageState, readState] = await Promise.all([
      prisma.message.aggregate({
        _count: { _all: true },
        _max: { createdAt: true, deletedAt: true, editedAt: true },
        where: { conversationId },
      }),
      prisma.conversationParticipant.aggregate({
        _max: { lastReadAt: true },
        where: { conversationId },
      }),
    ]);

    return {
      authorized: true,
      version: digest([
        "c",
        authorized.updatedAt.getTime(),
        messageState._count._all,
        toMillis(messageState._max.createdAt),
        toMillis(messageState._max.editedAt),
        toMillis(messageState._max.deletedAt),
        toMillis(readState._max.lastReadAt),
      ]),
    };
  }

  // Bounded to the same window the snapshot reconciles (51). Probing a wider
  // set than the snapshot would report changes that the full sync then never
  // applies, causing repeated pointless reconciliation.
  const conversations = await prisma.conversation.findMany({
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    select: { id: true, updatedAt: true },
    take: CHANGE_PROBE_CONVERSATION_WINDOW,
    where: accessWhere,
  });
  const conversationIds = conversations.map((conversation) => conversation.id);

  const [messageState, readState] = await Promise.all([
    prisma.message.aggregate({
      _count: { _all: true },
      _max: { createdAt: true, deletedAt: true, editedAt: true },
      where: { conversationId: { in: conversationIds } },
    }),
    prisma.conversationParticipant.aggregate({
      _max: { lastReadAt: true },
      where: { conversationId: { in: conversationIds } },
    }),
  ]);

  return {
    authorized: true,
    version: digest([
      "l",
      conversations.length,
      toMillis(conversations[0]?.updatedAt ?? null),
      messageState._count._all,
      toMillis(messageState._max.createdAt),
      toMillis(messageState._max.editedAt),
      toMillis(messageState._max.deletedAt),
      toMillis(readState._max.lastReadAt),
    ]),
  };
}

/**
 * Compares the current marker against the client's last known value.
 *
 * A missing or unrecognised `since` is reported as changed, so a client with no
 * prior state reconciles once rather than assuming it is up to date.
 */
export async function probeMessageChanges({
  conversationId,
  since,
  userId,
}: {
  conversationId: string | null;
  since: string | null;
  userId: string;
}): Promise<MessageChangeProbeResult> {
  const { authorized, version } = await getMessageChangeMarker({
    conversationId,
    userId,
  });
  if (!authorized) return { authorized: false, changed: false, version: "" };
  return { authorized: true, changed: since !== version, version };
}
