import { beforeEach, describe, expect, it, vi } from "vitest";

const tx = vi.hoisted(() => ({
  conversationEvent: { findFirst: vi.fn() },
  conversationParticipant: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  message: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
  },
  messageReadReceipt: { createMany: vi.fn() },
  notification: { updateMany: vi.fn() },
}));

const prisma = vi.hoisted(() => ({
  $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
}));

vi.mock("@/lib/db/prisma", () => ({ getPrisma: () => prisma }));

import { markConversationReadForUser } from "@/lib/messages/read-state";

describe("message read state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tx.conversationParticipant.findUnique.mockResolvedValue({
      id: "participant-1",
      lastReadAt: null,
      removedAt: null,
    });
    tx.conversationEvent.findFirst.mockResolvedValue(null);
    tx.message.findMany.mockResolvedValue([
      { id: "message-1" },
      { id: "message-2" },
    ]);
    tx.messageReadReceipt.createMany.mockResolvedValue({ count: 2 });
    tx.notification.updateMany.mockResolvedValue({ count: 2 });
  });

  it("marks the participant read through the latest message and receipts every inbound unread message", async () => {
    const latestAt = new Date("2026-07-31T12:00:00.000Z");
    tx.message.findFirst.mockResolvedValue({ createdAt: latestAt });

    await expect(
      markConversationReadForUser("conversation-1", "user-1"),
    ).resolves.toBe(true);

    expect(tx.conversationParticipant.findUnique).toHaveBeenCalledWith({
      select: { id: true, lastReadAt: true, removedAt: true },
      where: {
        conversationId_userId: {
          conversationId: "conversation-1",
          userId: "user-1",
        },
      },
    });
    expect(tx.message.findMany).toHaveBeenCalledWith({
      select: { id: true },
      where: {
        conversationId: "conversation-1",
        createdAt: { lte: latestAt },
        readReceipts: { none: { userId: "user-1" } },
        senderId: { not: "user-1" },
      },
    });
    expect(tx.conversationParticipant.update).toHaveBeenCalledWith({
      data: { lastReadAt: latestAt },
      where: {
        conversationId_userId: {
          conversationId: "conversation-1",
          userId: "user-1",
        },
      },
    });
    expect(tx.messageReadReceipt.createMany).toHaveBeenCalledWith({
      data: [
        { messageId: "message-1", userId: "user-1" },
        { messageId: "message-2", userId: "user-1" },
      ],
      skipDuplicates: true,
    });
    expect(tx.notification.updateMany).toHaveBeenCalledWith({
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
    const messageAt = new Date("2026-07-31T12:00:00.000Z");
    const eventAt = new Date("2026-07-31T12:05:00.000Z");
    tx.message.findFirst.mockResolvedValue({ createdAt: messageAt });
    tx.conversationEvent.findFirst.mockResolvedValue({ createdAt: eventAt });

    await expect(
      markConversationReadForUser("conversation-1", "user-1"),
    ).resolves.toBe(true);
    expect(tx.conversationParticipant.update).toHaveBeenCalledWith({
      data: { lastReadAt: eventAt },
      where: {
        conversationId_userId: {
          conversationId: "conversation-1",
          userId: "user-1",
        },
      },
    });
  });

  it("does not reopen a participant-locally removed conversation", async () => {
    tx.conversationParticipant.findUnique.mockResolvedValue({
      id: "participant-1",
      lastReadAt: null,
      removedAt: new Date(),
    });

    await expect(
      markConversationReadForUser("conversation-1", "user-1"),
    ).resolves.toBe(false);
    expect(tx.message.findFirst).not.toHaveBeenCalled();
    expect(tx.conversationEvent.findFirst).not.toHaveBeenCalled();
  });

  it("does not expose or mutate a conversation for a non-participant", async () => {
    tx.conversationParticipant.findUnique.mockResolvedValue(null);

    await expect(
      markConversationReadForUser("conversation-private", "outsider"),
    ).resolves.toBe(false);

    expect(tx.message.findFirst).not.toHaveBeenCalled();
    expect(tx.message.findMany).not.toHaveBeenCalled();
    expect(tx.conversationParticipant.update).not.toHaveBeenCalled();
    expect(tx.notification.updateMany).not.toHaveBeenCalled();
  });
});
