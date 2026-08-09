import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMocks = vi.hoisted(() => ({
  conversationFindMany: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  getPrisma: () => ({
    conversation: { findMany: prismaMocks.conversationFindMany },
  }),
}));

import { getMessageSnapshot } from "@/lib/messages/snapshot";
import { decodeCursor } from "@/lib/data/cursor";

describe("message snapshot history bounds", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a cursor for messages beyond the bounded live snapshot", async () => {
    const messages = Array.from({ length: 51 }, (_, index) => ({
      body: `Message ${index}`,
      createdAt: new Date(`2026-08-01T12:${String(index).padStart(2, "0")}:00.000Z`),
      deletedAt: null,
      editedAt: null,
      id: `message-${String(index).padStart(2, "0")}`,
      readReceipts: [],
      replyTo: null,
      sender: {
        id: "user-2",
        imageUrl: null,
        name: "Other User",
        username: "other-user",
      },
      senderId: "user-2",
    }));
    prismaMocks.conversationFindMany.mockResolvedValue([
      {
        events: [],
        id: "conversation-1",
        messages: [...messages].reverse(),
        opportunity: null,
        participants: [
          {
            lastReadAt: null,
            user: {
              id: "user-1",
              imageUrl: null,
              name: "Current User",
              profile: { showPresence: false },
              sessions: [],
              username: "current-user",
            },
            userId: "user-1",
          },
          {
            lastReadAt: null,
            user: {
              id: "user-2",
              imageUrl: null,
              name: "Other User",
              profile: { showPresence: false },
              sessions: [],
              username: "other-user",
            },
            userId: "user-2",
          },
        ],
        proposals: [],
        updatedAt: new Date("2026-08-01T12:50:00.000Z"),
      },
    ]);

    const snapshot = await getMessageSnapshot({
      conversationId: "conversation-1",
      userId: "user-1",
    });
    const conversation = snapshot.conversations?.[0] as {
      messages: { id: string }[];
      olderMessagesCursor?: string | null;
    };

    expect(conversation.messages).toHaveLength(50);
    expect(conversation.messages[0]?.id).toBe("message-01");
    expect(conversation.messages.at(-1)?.id).toBe("message-50");
    expect(conversation.olderMessagesCursor).toEqual(expect.any(String));
    expect(decodeCursor(conversation.olderMessagesCursor ?? undefined)).toEqual({
      id: "message-01",
      scope: "messages:user-1:conversation-1",
      timestamp: new Date("2026-08-01T12:01:00.000Z"),
    });
    expect(prismaMocks.conversationFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      }),
    );
    expect(
      prismaMocks.conversationFindMany.mock.calls[0]?.[0].include.messages,
    ).toMatchObject({
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 51,
    });
  });

  it("uses symmetric block relations when loading an exact conversation", async () => {
    prismaMocks.conversationFindMany.mockResolvedValue([]);

    const snapshot = await getMessageSnapshot({
      conversationId: "conversation-1",
      userId: "user-1",
    });

    expect(snapshot).toEqual({
      conversationList: null,
      conversations: null,
      notFound: true,
    });
    expect(prismaMocks.conversationFindMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({
          participants: {
            none: {
              user: {
                OR: [
                  { blocksMade: { some: { blockedUserId: "user-1" } } },
                  { blocksReceived: { some: { blockerUserId: "user-1" } } },
                ],
              },
            },
            some: { removedAt: null, userId: "user-1" },
          },
        }),
      }),
    );
  });

  it("skips the full conversation list between periodic exact-stream refreshes", async () => {
    prismaMocks.conversationFindMany.mockResolvedValue([]);

    await getMessageSnapshot({
      conversationId: "conversation-1",
      includeConversationList: false,
      userId: "user-1",
    });

    expect(prismaMocks.conversationFindMany).toHaveBeenCalledTimes(1);
    expect(prismaMocks.conversationFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 1 }),
    );
  });
});
