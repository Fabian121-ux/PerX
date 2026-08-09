import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  messageFindFirst: vi.fn(),
  requireUser: vi.fn(),
  revalidatePath: vi.fn(),
}));

const tx = vi.hoisted(() => ({
  auditLog: { create: vi.fn() },
  conversationParticipant: { updateMany: vi.fn() },
  message: { updateMany: vi.fn() },
}));

const prisma = vi.hoisted(() => ({
  $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
  message: { findFirst: mocks.messageFindFirst },
}));

vi.mock("@/lib/auth/session", () => ({
  getCurrentSessionTokenHash: vi.fn().mockResolvedValue("session-hash"),
  requireUser: mocks.requireUser,
}));
vi.mock("@/lib/db/prisma", () => ({ getPrisma: () => prisma }));
vi.mock("@/lib/env", () => ({
  getResolvedDataMode: () => "database",
  getServerEnv: () => ({ MESSAGE_EDIT_WINDOW_MINUTES: 15 }),
  hasDatabaseUrl: () => true,
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import {
  deleteMessageAction,
  removeConversationForMeAction,
} from "@/features/messages/actions";

const conversationId = "cl01234567890123456789012";
const messageId = "cl11234567890123456789012";

describe("participant-scoped message lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue({ id: "user-1", name: "Current User" });
    tx.conversationParticipant.updateMany.mockResolvedValue({ count: 1 });
    tx.message.updateMany.mockResolvedValue({ count: 1 });
  });

  it("removes only the current participant's chat-list entry", async () => {
    await expect(removeConversationForMeAction(conversationId)).resolves.toEqual({
      success: true,
    });

    expect(tx.conversationParticipant.updateMany).toHaveBeenCalledWith({
      data: { removedAt: expect.any(Date) },
      where: { conversationId, userId: "user-1" },
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "conversation.removed_for_participant",
        entityId: conversationId,
        metadata: { participantLocal: true },
      }),
    });
  });

  it("soft-deletes a recent owned message and retains an audited tombstone", async () => {
    mocks.messageFindFirst.mockResolvedValue({
      conversationId,
      createdAt: new Date(),
      deletedAt: null,
      senderId: "user-1",
    });

    await expect(deleteMessageAction(messageId)).resolves.toEqual({ success: true });
    expect(tx.message.updateMany).toHaveBeenCalledWith({
      data: { deletedAt: expect.any(Date), deletedById: "user-1" },
      where: { deletedAt: null, id: messageId, senderId: "user-1" },
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "message.deleted",
        metadata: {
          conversationId,
          retainedAsTombstone: true,
        },
      }),
    });
  });

  it("never lets a participant delete another sender's message", async () => {
    mocks.messageFindFirst.mockResolvedValue({
      conversationId,
      createdAt: new Date(),
      deletedAt: null,
      senderId: "user-2",
    });

    await expect(deleteMessageAction(messageId)).resolves.toEqual({
      error: "You can only remove your own messages.",
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(tx.message.updateMany).not.toHaveBeenCalled();
  });
});
