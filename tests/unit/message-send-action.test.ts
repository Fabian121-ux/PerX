import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  assertAccountAccessWithClient: vi.fn(),
  assertCanMessage: vi.fn(),
  requireUser: vi.fn(),
  revalidatePath: vi.fn(),
  getCurrentSessionTokenHash: vi.fn(),
  writeAuditLog: vi.fn(),
}));

const tx = vi.hoisted(() => ({
  $executeRawUnsafe: vi.fn(),
  blockedUser: { findFirst: vi.fn() },
  connection: { findFirst: vi.fn() },
  conversation: { findFirst: vi.fn(), update: vi.fn() },
  conversationParticipant: { updateMany: vi.fn() },
  message: { count: vi.fn(), create: vi.fn(), findFirst: vi.fn() },
  messageReadReceipt: { create: vi.fn() },
  notification: { createMany: vi.fn() },
  session: { findFirst: vi.fn() },
}));

const prisma = vi.hoisted(() => ({
  $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
  conversation: { findFirst: vi.fn() },
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/account/enforcement", () => ({
  assertAccountAccessWithClient: mocks.assertAccountAccessWithClient,
  assertCanMessage: mocks.assertCanMessage,
}));
vi.mock("@/lib/auth/session", () => ({
  getCurrentSessionTokenHash: mocks.getCurrentSessionTokenHash,
  requireUser: mocks.requireUser,
}));
vi.mock("@/lib/db/prisma", () => ({ getPrisma: () => prisma }));
vi.mock("@/lib/env", () => ({
  getResolvedDataMode: () => "database",
  getServerEnv: () => ({ MESSAGE_EDIT_WINDOW_MINUTES: 15 }),
  hasDatabaseUrl: () => true,
}));
vi.mock("@/lib/logging/audit", () => ({ writeAuditLog: mocks.writeAuditLog }));

import { sendMessageAction } from "@/features/messages/actions";

const conversationId = "cl01234567890123456789012";

describe("message send authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue({ id: "user-1", name: "Current User" });
    mocks.getCurrentSessionTokenHash.mockResolvedValue("session-hash");
    mocks.assertCanMessage.mockResolvedValue(null);
    mocks.assertAccountAccessWithClient.mockResolvedValue(null);
    prisma.conversation.findFirst.mockResolvedValue({ id: conversationId });
    tx.conversation.findFirst.mockResolvedValue({
      opportunityId: null,
      participants: [
        { userId: "user-1" },
        { userId: "user-2" },
      ],
    });
    tx.blockedUser.findFirst.mockResolvedValue(null);
    tx.message.count.mockResolvedValue(0);
    tx.message.findFirst.mockResolvedValue(null);
    tx.connection.findFirst.mockResolvedValue({ id: "connection-1" });
    tx.session.findFirst.mockResolvedValue({ id: "session-1" });
    tx.message.create.mockResolvedValue({
      createdAt: new Date("2026-08-08T12:00:00.000Z"),
      id: "message-1",
    });
  });

  it("takes the pair lock and rejects a block that committed before send", async () => {
    tx.blockedUser.findFirst.mockResolvedValue({ id: "block-1" });

    await expect(sendMessageAction(conversationId, "Hello")).resolves.toEqual({
      error: "Messaging is unavailable.",
    });

    expect(tx.$executeRawUnsafe).toHaveBeenCalledWith(
      "SELECT pg_advisory_xact_lock(hashtext($1))",
      "account:user-1",
    );
    expect(tx.$executeRawUnsafe).toHaveBeenCalledWith(
      "SELECT pg_advisory_xact_lock(hashtext($1))",
      "user-1:user-2",
    );
    expect(tx.$executeRawUnsafe.mock.invocationCallOrder[0]).toBeLessThan(
      tx.blockedUser.findFirst.mock.invocationCallOrder[0]!,
    );
    expect(tx.message.create).not.toHaveBeenCalled();
    expect(tx.notification.createMany).not.toHaveBeenCalled();
  });

  it("creates the message and notification only after the locked recheck", async () => {
    await expect(sendMessageAction(conversationId, "Hello")).resolves.toEqual({
      messageId: "message-1",
      success: true,
    });

    expect(tx.message.create).toHaveBeenCalledWith({
      data: {
        body: "Hello",
        conversationId,
        replyToMessageId: null,
        senderId: "user-1",
      },
    });
    expect(tx.notification.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          metadata: expect.objectContaining({ senderId: "user-1" }),
          userId: "user-2",
        }),
      ],
    });
    expect(tx.conversationParticipant.updateMany).toHaveBeenCalledTimes(1);
    expect(tx.conversationParticipant.updateMany).toHaveBeenCalledWith({
      data: { removedAt: null },
      where: { conversationId },
    });
  });

  it("rejects enforcement that commits before the locked recheck", async () => {
    mocks.assertAccountAccessWithClient.mockResolvedValue(
      "Messaging is temporarily restricted for this account.",
    );

    await expect(sendMessageAction(conversationId, "Hello")).resolves.toEqual({
      error: "Messaging is temporarily restricted for this account.",
    });

    expect(mocks.assertAccountAccessWithClient).toHaveBeenCalledWith(
      tx,
      "user-1",
      "message:send",
    );
    expect(tx.message.create).not.toHaveBeenCalled();
  });

  it("rejects a session revoked before the account lock is acquired", async () => {
    tx.session.findFirst.mockResolvedValue(null);

    await expect(sendMessageAction(conversationId, "Hello")).resolves.toEqual({
      error: "Authentication required.",
    });

    expect(mocks.assertAccountAccessWithClient).not.toHaveBeenCalled();
    expect(tx.message.create).not.toHaveBeenCalled();
  });
});
