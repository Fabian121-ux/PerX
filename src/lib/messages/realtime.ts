import { randomUUID } from "node:crypto";

import {
  createClient,
  type RealtimeChannel,
  type RealtimePostgresChangesPayload,
} from "@supabase/supabase-js";

import { getPrisma } from "@/lib/db/prisma";
import { getServerEnv } from "@/lib/env";
import { buildConversationAccessWhere } from "@/lib/messages/access";
import { MAX_LOADED_CONVERSATIONS } from "@/lib/messages/limits";

const realtimeFilterChunkSize = 100;

export type ConversationRealtimeChange =
  | {
      conversationId: string | null;
      includeConversationList: boolean;
      kind: "conversation";
      refreshSubscription?: boolean;
    }
  | {
      conversationId: string;
      eventType: "INSERT" | "UPDATE" | "DELETE";
      kind: "message";
      messageId: string;
    };

export type ConversationRealtimeStatus = "closed" | "error" | "subscribed";

export type ConversationRealtimeSubscription = {
  close: () => Promise<void>;
};

type RealtimeRow = {
  conversationId?: unknown;
  id?: unknown;
  removedAt?: unknown;
};

export async function hasConversationRealtimeAccess(
  conversationId: string,
  userId: string,
) {
  const conversation = await getPrisma().conversation.findFirst({
    select: { id: true },
    where: { ...buildConversationAccessWhere(userId), id: conversationId },
  });
  return Boolean(conversation);
}

export async function subscribeToConversationRealtime({
  conversationId,
  onChange,
  onStatus,
  userId,
}: {
  conversationId: string | null;
  onChange: (change: ConversationRealtimeChange) => void;
  onStatus: (status: ConversationRealtimeStatus) => void;
  userId: string;
}): Promise<ConversationRealtimeSubscription> {
  const env = getServerEnv();
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Message realtime is not configured.");
  }

  if (
    conversationId &&
    !(await hasConversationRealtimeAccess(conversationId, userId))
  ) {
    throw new Error("Message realtime access is unavailable.");
  }
  const authorizedConversations = await getPrisma().conversation.findMany({
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    select: { id: true },
    take: MAX_LOADED_CONVERSATIONS,
    where: buildConversationAccessWhere(userId),
  });
  const authorizedConversationIds = new Set(
    [
      ...(conversationId ? [conversationId] : []),
      ...authorizedConversations.map((conversation) => conversation.id),
    ].slice(0, MAX_LOADED_CONVERSATIONS),
  );
  const client = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    },
  );
  const channel = client.channel(
    `messages:${conversationId ?? "list"}:${userId}:${randomUUID()}`,
  );

  const handleMessage = (
    payload: RealtimePostgresChangesPayload<RealtimeRow>,
  ) => {
    const row = payload.eventType === "DELETE" ? payload.old : payload.new;
    if (
      typeof row.conversationId !== "string" ||
      !authorizedConversationIds.has(row.conversationId) ||
      typeof row.id !== "string"
    ) {
      return;
    }
    if (row.conversationId === conversationId) {
      onChange({
        conversationId: row.conversationId,
        eventType: payload.eventType,
        kind: "message",
        messageId: row.id,
      });
    } else {
      onChange({
        conversationId: row.conversationId,
        includeConversationList: true,
        kind: "conversation",
      });
    }
  };
  const handleConversationChange = (
    payload: RealtimePostgresChangesPayload<RealtimeRow>,
  ) => {
    const row = payload.eventType === "DELETE" ? payload.old : payload.new;
    if (
      typeof row.conversationId !== "string" ||
      !authorizedConversationIds.has(row.conversationId)
    ) {
      return;
    }
    onChange({
      conversationId: row.conversationId,
      includeConversationList: true,
      kind: "conversation",
    });
  };
  const handleCurrentParticipantChange = (
    payload: RealtimePostgresChangesPayload<RealtimeRow>,
  ) => {
    const row = payload.eventType === "DELETE" ? payload.old : payload.new;
    if (typeof row.conversationId !== "string") return;
    const refreshSubscription =
      payload.eventType !== "UPDATE" ||
      payload.old.removedAt !== payload.new.removedAt;
    onChange({
      conversationId: row.conversationId,
      includeConversationList: true,
      kind: "conversation",
      refreshSubscription,
    });
  };
  const handleActiveParticipantChange = (
    payload: RealtimePostgresChangesPayload<RealtimeRow>,
  ) => {
    const row = payload.eventType === "DELETE" ? payload.old : payload.new;
    if (!conversationId || row.conversationId !== conversationId) return;
    onChange({
      conversationId,
      includeConversationList: false,
      kind: "conversation",
    });
  };

  for (const conversationIds of chunkValues(
    [...authorizedConversationIds],
    realtimeFilterChunkSize,
  )) {
    const conversationFilter = `conversationId=in.(${conversationIds.join(",")})`;
    channel
      .on(
        "postgres_changes",
        {
          event: "*",
          filter: conversationFilter,
          schema: "public",
          table: "Message",
        },
        handleMessage,
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          filter: conversationFilter,
          schema: "public",
          table: "ConversationEvent",
        },
        handleConversationChange,
      );
  }

  channel.on(
    "postgres_changes",
    {
      event: "*",
      filter: `userId=eq.${userId}`,
      schema: "public",
      table: "ConversationParticipant",
    },
    handleCurrentParticipantChange,
  );
  if (conversationId) {
    channel.on(
      "postgres_changes",
      {
        event: "*",
        filter: `conversationId=eq.${conversationId}`,
        schema: "public",
        table: "ConversationParticipant",
      },
      handleActiveParticipantChange,
    );
  }

  try {
    await waitForSubscription(channel, onStatus);
  } catch (error) {
    await client.removeChannel(channel).catch(() => undefined);
    throw error;
  }

  let closed = false;
  return {
    close: async () => {
      if (closed) return;
      closed = true;
      await client.removeChannel(channel);
    },
  };
}

function chunkValues<T>(values: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

async function waitForSubscription(
  channel: RealtimeChannel,
  onStatus: (status: ConversationRealtimeStatus) => void,
) {
  await new Promise<void>((resolve, reject) => {
    let settled = false;
    channel.subscribe((status, error) => {
      if (status === "SUBSCRIBED") {
        onStatus("subscribed");
        if (!settled) {
          settled = true;
          resolve();
        }
        return;
      }

      const nextStatus = status === "CLOSED" ? "closed" : "error";
      onStatus(nextStatus);
      if (!settled) {
        settled = true;
        reject(error ?? new Error(`Message realtime ${status.toLowerCase()}.`));
      }
    });
  });
}
