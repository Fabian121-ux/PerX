import { beforeEach, describe, expect, it, vi } from "vitest";

const tx = vi.hoisted(() => ({
  $queryRaw: vi.fn(),
  conversation: { findFirst: vi.fn() },
  conversationEvent: { findFirst: vi.fn() },
  conversationParticipant: {
    findUnique: vi.fn(),
    updateMany: vi.fn(),
  },
  message: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
  },
  messageReadReceipt: { createMany: vi.fn() },
  notification: { updateMany: vi.fn() },
}));

const prisma = vi.hoisted(() => ({
  $transaction: vi.fn((callback: (client: typeof tx) => unknown) =>
    callback(tx),
  ),
  message: { findMany: vi.fn() },
  messageReadReceipt: { createMany: vi.fn() },
  notification: { updateMany: vi.fn() },
}));

vi.mock("@/lib/db/prisma", () => ({ getPrisma: () => prisma }));

import { markConversationReadForUser } from "@/lib/messages/read-state";

describe("message read state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.$transaction.mockImplementation(
      (callback: (client: typeof tx) => unknown) => callback(tx),
    );
    tx.conversation.findFirst.mockResolvedValue({
      participants: [{ id: "participant-1", lastReadAt: null }],
    });
    tx.conversationEvent.findFirst.mockResolvedValue(null);
    prisma.message.findMany.mockResolvedValue([
      { id: "message-1" },
      { id: "message-2" },
    ]);
    prisma.messageReadReceipt.createMany.mockResolvedValue({ count: 2 });
    prisma.notification.updateMany.mockResolvedValue({ count: 2 });
    tx.conversationParticipant.updateMany.mockResolvedValue({ count: 1 });
    tx.$queryRaw.mockResolvedValue([{ id: "participant-1" }]);
  });

  it("marks the participant read through the latest message and receipts every inbound unread message", async () => {
    const latestAt = new Date("2026-07-31T12:00:00.000Z");
    tx.message.findFirst.mockResolvedValue({
      createdAt: latestAt,
      id: "message-2",
    });

    await expect(
      markConversationReadForUser("conversation-1", "user-1", {
        id: "message-2",
        kind: "message",
      }),
    ).resolves.toBe(true);

    expect(tx.conversation.findFirst).toHaveBeenCalledWith({
      select: {
        participants: {
          select: { id: true, lastReadAt: true },
          where: { removedAt: null, userId: "user-1" },
        },
      },
      where: {
        id: "conversation-1",
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
        status: "ACTIVE",
      },
    });
    expect(prisma.message.findMany).toHaveBeenCalledWith({
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: { id: true },
      take: 100,
      where: {
        conversationId: "conversation-1",
        OR: [
          { createdAt: { lt: latestAt } },
          { createdAt: latestAt, id: { lte: "message-2" } },
        ],
        readReceipts: { none: { userId: "user-1" } },
        senderId: { not: "user-1" },
      },
    });
    expect(tx.conversationParticipant.updateMany).toHaveBeenCalledWith({
      data: { lastReadAt: latestAt },
      where: {
        conversationId: "conversation-1",
        OR: [{ lastReadAt: null }, { lastReadAt: { lt: latestAt } }],
        removedAt: null,
        userId: "user-1",
      },
    });
    expect(prisma.messageReadReceipt.createMany).toHaveBeenCalledWith({
      data: [
        { messageId: "message-1", userId: "user-1" },
        { messageId: "message-2", userId: "user-1" },
      ],
      skipDuplicates: true,
    });
    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      data: { readAt: expect.any(Date) },
      where: {
        OR: [
          { actionUrl: "/app/messages/conversation-1" },
          { actionUrl: { startsWith: "/app/messages/conversation-1?" } },
          {
            metadata: {
              equals: "conversation-1",
              path: ["conversationId"],
            },
          },
        ],
        createdAt: { lte: latestAt },
        readAt: null,
        type: {
          in: [
            "DEAL",
            "DEAL_UPDATE",
            "MESSAGE",
            "MESSAGE_REQUEST_RECEIVED",
            "NEW_MESSAGE",
            "PROPOSAL",
            "PROPOSAL_UPDATE",
          ],
        },
        userId: "user-1",
      },
    });
  });

  it("marks read through a newer immutable conversation event", async () => {
    const eventAt = new Date("2026-07-31T12:05:00.000Z");
    tx.conversationEvent.findFirst.mockResolvedValue({
      createdAt: eventAt,
      id: "event-1",
    });

    await expect(
      markConversationReadForUser("conversation-1", "user-1", {
        id: "event-1",
        kind: "event",
      }),
    ).resolves.toBe(true);
    expect(tx.conversationParticipant.updateMany).toHaveBeenCalledWith({
      data: { lastReadAt: eventAt },
      where: {
        conversationId: "conversation-1",
        OR: [{ lastReadAt: null }, { lastReadAt: { lt: eventAt } }],
        removedAt: null,
        userId: "user-1",
      },
    });
  });

  it("does not advance beyond the exact rendered entry", async () => {
    const renderedAt = new Date("2026-07-31T12:00:00.000Z");
    tx.message.findFirst.mockResolvedValue({
      createdAt: renderedAt,
      id: "message-rendered",
    });
    prisma.message.findMany.mockResolvedValue([{ id: "message-rendered" }]);

    await markConversationReadForUser("conversation-1", "user-1", {
      id: "message-rendered",
      kind: "message",
    });

    expect(prisma.message.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            { createdAt: { lt: renderedAt } },
            {
              createdAt: renderedAt,
              id: { lte: "message-rendered" },
            },
          ],
        }),
      }),
    );
    expect(tx.conversationParticipant.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { lastReadAt: renderedAt } }),
    );
  });

  it("does not reopen a participant-locally removed conversation", async () => {
    tx.conversation.findFirst.mockResolvedValue(null);

    await expect(
      markConversationReadForUser("conversation-1", "user-1"),
    ).resolves.toBe(false);
    expect(tx.message.findFirst).not.toHaveBeenCalled();
    expect(tx.conversationEvent.findFirst).not.toHaveBeenCalled();
  });

  it("does not expose or mutate a conversation for a non-participant", async () => {
    tx.conversation.findFirst.mockResolvedValue(null);

    await expect(
      markConversationReadForUser("conversation-private", "outsider"),
    ).resolves.toBe(false);

    expect(tx.message.findFirst).not.toHaveBeenCalled();
    expect(prisma.message.findMany).not.toHaveBeenCalled();
    expect(tx.conversationParticipant.updateMany).not.toHaveBeenCalled();
    expect(prisma.notification.updateMany).not.toHaveBeenCalled();
  });

  it("retries only transient P2034 transaction conflicts", async () => {
    const conflict = { code: "P2034" };
    tx.message.findFirst.mockResolvedValue({
      createdAt: new Date("2026-07-31T12:00:00.000Z"),
      id: "message-2",
    });
    prisma.$transaction
      .mockRejectedValueOnce(conflict)
      .mockImplementationOnce((callback: (client: typeof tx) => unknown) =>
        callback(tx),
      );

    await expect(
      markConversationReadForUser("conversation-1", "user-1", {
        id: "message-2",
        kind: "message",
      }),
    ).resolves.toBe(true);

    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
  });

  it("surfaces P2034 after the bounded retry limit", async () => {
    const conflict = { code: "P2034" };
    prisma.$transaction.mockRejectedValue(conflict);

    await expect(
      markConversationReadForUser("conversation-1", "user-1"),
    ).rejects.toBe(conflict);
    expect(prisma.$transaction).toHaveBeenCalledTimes(3);
  });

  it("does not retry unrelated Prisma failures", async () => {
    const failure = { code: "P2002" };
    prisma.$transaction.mockRejectedValue(failure);

    await expect(
      markConversationReadForUser("conversation-1", "user-1"),
    ).rejects.toBe(failure);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
});
