import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  closeRealtime: vi.fn(),
  getCurrentUser: vi.fn(),
  getMessageMutationsAfter: vi.fn(),
  getMessageSnapshot: vi.fn(),
  getRealtimeWorkspaceMessage: vi.fn(),
  hasConversationRealtimeAccess: vi.fn(),
  subscribeToConversationRealtime: vi.fn(),
  validateCurrentSessionAccess: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getCurrentUser: mocks.getCurrentUser,
  validateCurrentSessionAccess: mocks.validateCurrentSessionAccess,
}));
vi.mock("@/lib/messages/mutations", () => ({
  createMessageMutationBaseline: () => "baseline-cursor",
  getMessageMutationsAfter: mocks.getMessageMutationsAfter,
  validateMessageMutationCursor: vi.fn(),
}));
vi.mock("@/lib/messages/realtime", () => ({
  hasConversationRealtimeAccess: mocks.hasConversationRealtimeAccess,
  subscribeToConversationRealtime: mocks.subscribeToConversationRealtime,
}));
vi.mock("@/lib/messages/realtime-message", () => ({
  getRealtimeWorkspaceMessage: mocks.getRealtimeWorkspaceMessage,
}));
vi.mock("@/lib/messages/snapshot", () => ({
  getMessageSnapshot: mocks.getMessageSnapshot,
}));

import { GET } from "@/app/api/messages/events/route";

function request(signal?: AbortSignal) {
  return new Request(
    "http://localhost/api/messages/events?conversationId=conversation-1",
    signal ? { signal } : undefined,
  );
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

async function readUntil(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  expected: string,
) {
  const decoder = new TextDecoder();
  let output = "";
  for (let index = 0; index < 20 && !output.includes(expected); index += 1) {
    const chunk = await reader.read();
    if (chunk.done) break;
    output += decoder.decode(chunk.value, { stream: true });
  }
  return output;
}

describe("message events route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentUser.mockResolvedValue({
      id: "user-1",
      roles: [],
    });
    mocks.hasConversationRealtimeAccess.mockResolvedValue(true);
    mocks.validateCurrentSessionAccess.mockResolvedValue(true);
    mocks.getMessageSnapshot.mockResolvedValue({
      conversationList: { ids: ["conversation-1"], nextCursor: null },
      conversations: [],
      notFound: false,
    });
    mocks.getMessageMutationsAfter.mockResolvedValue({
      checkpoint: "checkpoint-1",
      hasMore: false,
      items: [],
    });
    mocks.closeRealtime.mockResolvedValue(undefined);
    mocks.subscribeToConversationRealtime.mockImplementation(
      async ({ onStatus }: { onStatus: (status: string) => void }) => {
        onStatus("subscribed");
        return { close: mocks.closeRealtime };
      },
    );
  });

  it("authorizes before opening realtime and sends the initial bounded reconciliation", async () => {
    const response = await GET(request());
    const reader = response.body!.getReader();
    const output = await readUntil(reader, "event: conversations");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    expect(mocks.hasConversationRealtimeAccess).toHaveBeenCalledWith(
      "conversation-1",
      "user-1",
    );
    expect(
      mocks.hasConversationRealtimeAccess.mock.invocationCallOrder[0],
    ).toBeLessThan(
      mocks.subscribeToConversationRealtime.mock.invocationCallOrder[0]!,
    );
    expect(output).toContain("retry: 5000");
    expect(output).toContain("id: checkpoint-1");
    expect(mocks.getMessageSnapshot).toHaveBeenCalledTimes(1);

    await reader.cancel();
    expect(mocks.closeRealtime).toHaveBeenCalledTimes(1);
  });

  it("closes a subscription that resolves after the stream is cancelled", async () => {
    const pending = deferred<{ close: () => Promise<void> }>();
    mocks.subscribeToConversationRealtime.mockReturnValue(pending.promise);
    const response = await GET(request());
    const reader = response.body!.getReader();

    await reader.cancel();
    pending.resolve({ close: mocks.closeRealtime });
    await vi.waitFor(() =>
      expect(mocks.closeRealtime).toHaveBeenCalledTimes(1),
    );
    expect(mocks.getMessageSnapshot).not.toHaveBeenCalled();
  });

  it("cancels a pending retry when the stream closes", async () => {
    vi.useFakeTimers();
    try {
      mocks.subscribeToConversationRealtime.mockRejectedValue(
        new Error("realtime unavailable"),
      );
      const response = await GET(request());
      const reader = response.body!.getReader();
      await readUntil(reader, "event: stream-error");

      await reader.cancel();
      await vi.advanceTimersByTimeAsync(5_000);

      expect(mocks.subscribeToConversationRealtime).toHaveBeenCalledTimes(1);
    } finally {
      vi.clearAllTimers();
      vi.useRealTimers();
    }
  });

  it("ignores status callbacks from an obsolete subscription generation", async () => {
    vi.useFakeTimers();
    try {
      const closeFirst = vi.fn().mockResolvedValue(undefined);
      const closeSecond = vi.fn().mockResolvedValue(undefined);
      const statuses: Array<(status: string) => void> = [];
      mocks.subscribeToConversationRealtime
        .mockImplementationOnce(
          async ({ onStatus }: { onStatus: (status: string) => void }) => {
            statuses.push(onStatus);
            onStatus("subscribed");
            return { close: closeFirst };
          },
        )
        .mockImplementationOnce(
          async ({ onStatus }: { onStatus: (status: string) => void }) => {
            statuses.push(onStatus);
            onStatus("subscribed");
            return { close: closeSecond };
          },
        );
      const response = await GET(request());
      const reader = response.body!.getReader();
      await readUntil(reader, "event: conversations");

      statuses[0]!("error");
      await vi.advanceTimersByTimeAsync(5_000);
      expect(mocks.subscribeToConversationRealtime).toHaveBeenCalledTimes(2);
      expect(closeFirst).toHaveBeenCalledTimes(1);

      statuses[0]!("error");
      await vi.advanceTimersByTimeAsync(5_000);
      expect(mocks.subscribeToConversationRealtime).toHaveBeenCalledTimes(2);
      expect(closeSecond).not.toHaveBeenCalled();

      await reader.cancel();
      expect(closeSecond).toHaveBeenCalledTimes(1);
    } finally {
      vi.clearAllTimers();
      vi.useRealTimers();
    }
  });

  it("closes the stream when periodic authorization is revoked", async () => {
    vi.useFakeTimers();
    try {
      const response = await GET(request());
      const reader = response.body!.getReader();
      await readUntil(reader, "event: conversations");
      mocks.hasConversationRealtimeAccess.mockResolvedValue(false);

      const outputPromise = readUntil(reader, "event: unavailable");
      await vi.advanceTimersByTimeAsync(30_000);
      const output = await outputPromise;

      expect(output).toContain("event: unavailable");
      expect(mocks.validateCurrentSessionAccess).toHaveBeenCalledTimes(1);
      expect(mocks.closeRealtime).toHaveBeenCalledTimes(1);
    } finally {
      vi.clearAllTimers();
      vi.useRealTimers();
    }
  });

  it("drops stale realtime hydration when a newer change wins", async () => {
    const first = deferred<{
      body: string;
      createdAt: string;
      id: string;
      senderId: string;
      senderName: string;
    }>();
    const second = deferred<{
      body: string;
      createdAt: string;
      id: string;
      senderId: string;
      senderName: string;
    }>();
    let onChange!: (change: unknown) => void;
    mocks.subscribeToConversationRealtime.mockImplementation(
      async (options: {
        onChange: (change: unknown) => void;
        onStatus: (status: string) => void;
      }) => {
        onChange = options.onChange;
        options.onStatus("subscribed");
        return { close: mocks.closeRealtime };
      },
    );
    mocks.getRealtimeWorkspaceMessage
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const response = await GET(request());
    const reader = response.body!.getReader();
    await readUntil(reader, "event: conversations");

    onChange({
      conversationId: "conversation-1",
      eventType: "INSERT",
      kind: "message",
      messageId: "message-1",
    });
    onChange({
      conversationId: "conversation-1",
      eventType: "UPDATE",
      kind: "message",
      messageId: "message-1",
    });
    second.resolve({
      body: "Newest body",
      createdAt: "2026-08-24T12:00:00.000Z",
      id: "message-1",
      senderId: "user-2",
      senderName: "Other User",
    });
    const outputPromise = readUntil(reader, "Newest body");
    first.resolve({
      body: "Stale body",
      createdAt: "2026-08-24T12:00:00.000Z",
      id: "message-1",
      senderId: "user-2",
      senderName: "Other User",
    });
    const output = await outputPromise;

    expect(output).toContain("Newest body");
    expect(output).not.toContain("Stale body");
    await reader.cancel();
  });

  it("drains mutation pages without repeating the snapshot query", async () => {
    mocks.getMessageMutationsAfter
      .mockResolvedValueOnce({
        checkpoint: "checkpoint-1",
        hasMore: true,
        items: [{ id: "mutation-1" }],
      })
      .mockResolvedValueOnce({
        checkpoint: "checkpoint-2",
        hasMore: false,
        items: [{ id: "mutation-2" }],
      });
    const response = await GET(request());
    const reader = response.body!.getReader();
    const output = await readUntil(reader, "mutation-2");

    expect(output).toContain("mutation-1");
    expect(output).toContain("mutation-2");
    expect(mocks.getMessageSnapshot).toHaveBeenCalledTimes(1);
    expect(mocks.getMessageMutationsAfter).toHaveBeenCalledTimes(2);
    await reader.cancel();
  });
});
