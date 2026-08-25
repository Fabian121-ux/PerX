import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  channel: null as unknown as {
    on: ReturnType<typeof vi.fn>;
    subscribe: ReturnType<typeof vi.fn>;
  },
  conversationFindFirst: vi.fn(),
  conversationFindMany: vi.fn(),
  createClient: vi.fn(),
  env: {
    NEXT_PUBLIC_SUPABASE_URL: "https://realtime.perx.test",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
  },
  removeChannel: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: mocks.createClient,
}));
vi.mock("@/lib/db/prisma", () => ({
  getPrisma: () => ({
    conversation: {
      findFirst: mocks.conversationFindFirst,
      findMany: mocks.conversationFindMany,
    },
  }),
}));
vi.mock("@/lib/env", () => ({ getServerEnv: () => mocks.env }));

import {
  hasConversationRealtimeAccess,
  subscribeToConversationRealtime,
} from "@/lib/messages/realtime";

describe("message realtime subscriptions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const channel = {
      on: vi.fn(),
      subscribe: vi.fn(),
    };
    channel.on.mockReturnValue(channel);
    channel.subscribe.mockImplementation((listener: (status: string) => void) =>
      listener("SUBSCRIBED"),
    );
    mocks.channel = channel;
    mocks.removeChannel.mockResolvedValue(undefined);
    mocks.createClient.mockReturnValue({
      channel: vi.fn(() => channel),
      removeChannel: mocks.removeChannel,
    });
    mocks.conversationFindFirst.mockResolvedValue({
      id: "conversation-selected",
    });
    mocks.conversationFindMany.mockResolvedValue(
      Array.from({ length: 200 }, (_, index) => ({
        id: `conversation-${String(index).padStart(3, "0")}`,
      })),
    );
  });

  it("uses the shared authorization predicate for exact access", async () => {
    await expect(
      hasConversationRealtimeAccess("conversation-selected", "user-1"),
    ).resolves.toBe(true);

    expect(mocks.conversationFindFirst).toHaveBeenCalledWith({
      select: { id: true },
      where: expect.objectContaining({
        id: "conversation-selected",
        participants: expect.objectContaining({
          some: { removedAt: null, userId: "user-1" },
        }),
      }),
    });
  });

  it("keeps the selected conversation inside the 200-conversation bound and chunks filters", async () => {
    const onChange = vi.fn();
    const onStatus = vi.fn();

    const subscription = await subscribeToConversationRealtime({
      conversationId: "conversation-selected",
      onChange,
      onStatus,
      userId: "user-1",
    });

    expect(mocks.conversationFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 200 }),
    );
    expect(mocks.conversationFindFirst).toHaveBeenCalledTimes(1);
    expect(mocks.conversationFindMany).toHaveBeenCalledTimes(1);
    const messageRegistrations = mocks.channel.on.mock.calls.filter(
      (call) => call[1]?.table === "Message",
    );
    expect(messageRegistrations).toHaveLength(2);
    expect(messageRegistrations[0]?.[1].filter).toContain(
      "conversation-selected",
    );
    expect(
      messageRegistrations
        .flatMap((call) =>
          String(call[1].filter)
            .replace("conversationId=in.(", "")
            .replace(")", "")
            .split(","),
        )
        .filter(Boolean),
    ).toHaveLength(200);
    expect(onStatus).toHaveBeenCalledWith("subscribed");

    await subscription.close();
    await subscription.close();
    expect(mocks.removeChannel).toHaveBeenCalledTimes(1);
  });

  it("removes the channel when startup fails", async () => {
    mocks.channel.subscribe.mockImplementation(
      (listener: (status: string, error?: Error) => void) =>
        listener("CHANNEL_ERROR", new Error("failed")),
    );

    await expect(
      subscribeToConversationRealtime({
        conversationId: "conversation-selected",
        onChange: vi.fn(),
        onStatus: vi.fn(),
        userId: "user-1",
      }),
    ).rejects.toThrow("failed");
    expect(mocks.removeChannel).toHaveBeenCalledWith(mocks.channel);
  });

  it("restarts membership only when removedAt changes", async () => {
    const onChange = vi.fn();
    await subscribeToConversationRealtime({
      conversationId: "conversation-selected",
      onChange,
      onStatus: vi.fn(),
      userId: "user-1",
    });
    const participantRegistration = mocks.channel.on.mock.calls.find(
      (call) =>
        call[1]?.table === "ConversationParticipant" &&
        call[1]?.filter === "userId=eq.user-1",
    );
    const listener = participantRegistration?.[2] as (payload: unknown) => void;

    listener({
      eventType: "UPDATE",
      new: { conversationId: "conversation-selected", removedAt: null },
      old: { conversationId: "conversation-selected", removedAt: null },
    });
    listener({
      eventType: "UPDATE",
      new: {
        conversationId: "conversation-selected",
        removedAt: "2026-08-24T12:00:00.000Z",
      },
      old: { conversationId: "conversation-selected", removedAt: null },
    });

    expect(onChange).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ refreshSubscription: false }),
    );
    expect(onChange).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ refreshSubscription: true }),
    );
  });
});
