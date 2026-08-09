import type { Prisma } from "@/generated/prisma/client";
import {
  encodeCursor,
  normalizeCursorPageParams,
  withCursor,
} from "@/lib/data/cursor";
import { getPrisma } from "@/lib/db/prisma";
import { buildConversationAccessWhere } from "@/lib/messages/access";

const mutationPageSize = 50;
const messageMutationSafetyWindowMs = 30_000;
const messageMutationCursorMaxAgeMs = 15 * 60_000;
const messageMutationCursorFutureSkewMs = 60_000;
export const messageMutationTransactionTimeoutMs = 5_000;

export type MessageMutation = {
  body: string;
  conversationId: string;
  deletedAt: string | null;
  editedAt: string | null;
  id: string;
};

function mutationScope(userId: string, conversationId: string) {
  return `message-mutations:${userId}:${conversationId}`;
}

export function createMessageMutationBaseline(
  userId: string,
  conversationId: string,
  timestamp = new Date(Date.now() - messageMutationSafetyWindowMs),
) {
  return encodeCursor({
    id: "0",
    scope: mutationScope(userId, conversationId),
    timestamp,
  });
}

export function validateMessageMutationCursor(
  requestedCursor: string,
  userId: string,
  conversationId: string,
) {
  const { cursor } = normalizeCursorPageParams(
    { cursor: requestedCursor, pageSize: mutationPageSize },
    mutationScope(userId, conversationId),
  );
  assertMutationCursorWindow(cursor?.timestamp);
}

export async function getMessageMutationsAfter({
  conversationId,
  cursor: requestedCursor,
  userId,
}: {
  conversationId: string;
  cursor: string;
  userId: string;
}) {
  const scope = mutationScope(userId, conversationId);
  const { cursor } = normalizeCursorPageParams(
    { cursor: requestedCursor, pageSize: mutationPageSize },
    scope,
  );
  if (!cursor) throw new Error("Invalid cursor.");
  assertMutationCursorWindow(cursor.timestamp);

  const safeUpperBound = new Date(Date.now() - messageMutationSafetyWindowMs);
  const auditRows = await getPrisma().auditLog.findMany({
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { createdAt: true, entityId: true, id: true },
    take: mutationPageSize + 1,
    where: withCursor<Prisma.AuditLogWhereInput>(
      {
        action: { in: ["message.deleted", "message.edited"] },
        createdAt: { lte: safeUpperBound },
        entityId: { not: null },
        entityType: "message",
        metadata: { path: ["conversationId"], equals: conversationId },
      },
      cursor,
      { direction: "asc", field: "createdAt" },
    ),
  });
  const hasMore = auditRows.length > mutationPageSize;
  const pageRows = hasMore ? auditRows.slice(0, mutationPageSize) : auditRows;
  const messageIds = [
    ...new Set(
      pageRows
        .map((row) => row.entityId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const messages = messageIds.length
    ? await getPrisma().message.findMany({
        select: {
          body: true,
          conversationId: true,
          deletedAt: true,
          editedAt: true,
          id: true,
        },
        where: {
          conversation: buildConversationAccessWhere(userId),
          conversationId,
          id: { in: messageIds },
        },
      })
    : [];
  const messagesById = new Map(messages.map((message) => [message.id, message]));
  const checkpointRow = pageRows.at(-1);
  const completedPageTimestamp =
    safeUpperBound > cursor.timestamp ? safeUpperBound : cursor.timestamp;
  const checkpoint =
    hasMore && checkpointRow
      ? encodeCursor({
          id: checkpointRow.id,
          scope,
          timestamp: checkpointRow.createdAt,
        })
      : encodeCursor({ id: "0", scope, timestamp: completedPageTimestamp });

  return {
    checkpoint,
    hasMore,
    items: messageIds.flatMap((messageId): MessageMutation[] => {
      const message = messagesById.get(messageId);
      if (!message) return [];
      return [
        {
          body: message.deletedAt ? "" : message.body,
          conversationId: message.conversationId,
          deletedAt: message.deletedAt?.toISOString() ?? null,
          editedAt: message.editedAt?.toISOString() ?? null,
          id: message.id,
        },
      ];
    }),
  };
}

function assertMutationCursorWindow(timestamp?: Date) {
  if (!timestamp) throw new Error("Invalid cursor.");
  const ageMs = Date.now() - timestamp.getTime();
  if (
    ageMs > messageMutationCursorMaxAgeMs ||
    ageMs < -messageMutationCursorFutureSkewMs
  ) {
    throw new Error("Invalid cursor.");
  }
}
