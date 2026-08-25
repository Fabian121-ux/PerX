import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMocks = vi.hoisted(() => ({
  conversationFindMany: vi.fn(),
  messageFindFirst: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  getPrisma: () => ({
    conversation: { findMany: prismaMocks.conversationFindMany },
    message: { findFirst: prismaMocks.messageFindFirst },
  }),
}));

import { getMessageSnapshot } from "@/lib/messages/snapshot";
import { decodeCursor } from "@/lib/data/cursor";

describe("message snapshot history bounds", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMocks.messageFindFirst.mockResolvedValue(null);
  });

  it("returns a cursor for messages beyond the bounded live snapshot", async () => {
    const messages = Array.from({ length: 51 }, (_, index) => ({
      body: `Message ${index}`,
      createdAt: new Date(
        `2026-08-01T12:${String(index).padStart(2, "0")}:00.000Z`,
      ),
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
    expect(decodeCursor(conversation.olderMessagesCursor ?? undefined)).toEqual(
      {
        id: "message-01",
        scope: "messages:user-1:conversation-1",
        timestamp: new Date("2026-08-01T12:01:00.000Z"),
      },
    );
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

  it("keeps both authorization IDs and conversation payloads bounded", async () => {
    const conversations = Array.from({ length: 51 }, (_, index) => ({
      events: [],
      id: `conversation-${String(index).padStart(2, "0")}`,
      messages: [],
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
            id: `other-${index}`,
            imageUrl: null,
            name: `Other User ${index}`,
            profile: { showPresence: false },
            sessions: [],
            username: `other-${index}`,
          },
          userId: `other-${index}`,
        },
      ],
      proposals: [],
      updatedAt: new Date(
        `2026-08-01T12:${String(index).padStart(2, "0")}:00.000Z`,
      ),
    }));
    prismaMocks.conversationFindMany.mockResolvedValue(conversations);

    const snapshot = await getMessageSnapshot({ userId: "user-1" });

    expect(snapshot.conversations).toHaveLength(50);
    expect(snapshot.conversationList?.ids).toHaveLength(50);
    expect(snapshot.conversationList?.ids).not.toContain("conversation-50");
    expect(snapshot.conversationList?.nextCursor).toEqual(expect.any(String));
  });

  it("loads the true unread boundary even when it is older than the live window", async () => {
    const messages = Array.from({ length: 51 }, (_, index) => ({
      body: `Loaded message ${index + 1}`,
      createdAt: new Date(
        `2026-08-02T12:${String(index).padStart(2, "0")}:00.000Z`,
      ),
      deletedAt: null,
      editedAt: null,
      id: `message-loaded-${index + 1}`,
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
    const initialUnreadMessage = {
      ...messages[0],
      body: "True first unread message",
      createdAt: new Date("2026-08-02T10:00:00.000Z"),
      id: "message-first-unread",
    };
    prismaMocks.conversationFindMany.mockResolvedValue([
      {
        events: [],
        id: "conversation-1",
        messages: [...messages].reverse(),
        opportunity: null,
        participants: [
          {
            lastReadAt: new Date("2026-08-02T09:59:00.000Z"),
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
        updatedAt: new Date("2026-08-02T13:00:00.000Z"),
      },
    ]);
    prismaMocks.messageFindFirst.mockResolvedValue(initialUnreadMessage);

    const snapshot = await getMessageSnapshot({
      conversationId: "conversation-1",
      includeConversationList: false,
      userId: "user-1",
    });
    const conversation = snapshot.conversations?.[0] as {
      initialUnreadMessageId: string | null;
      messages: { id: string }[];
    };

    expect(conversation.initialUnreadMessageId).toBe("message-first-unread");
    expect(conversation.messages[0]?.id).toBe("message-first-unread");
    expect(conversation.messages).toHaveLength(51);
    expect(prismaMocks.messageFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        where: expect.objectContaining({
          conversationId: "conversation-1",
          createdAt: { gt: new Date("2026-08-02T09:59:00.000Z") },
          readReceipts: { none: { userId: "user-1" } },
          senderId: { not: "user-1" },
        }),
      }),
    );
  });
});
