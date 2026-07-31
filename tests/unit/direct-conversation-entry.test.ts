import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  assertCanRequestConnection: vi.fn(),
  redirect: vi.fn(),
  revalidatePath: vi.fn(),
  requireUser: vi.fn(),
  writeAuditLog: vi.fn(),
}));

const tx = vi.hoisted(() => ({
  $executeRawUnsafe: vi.fn(),
  blockedUser: { findFirst: vi.fn() },
  connection: { findFirst: vi.fn() },
  conversation: {
    create: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  },
  user: { findMany: vi.fn() },
}));

const prisma = vi.hoisted(() => ({
  $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
}));

vi.mock("@/lib/account/enforcement", () => ({
  assertCanRequestConnection: mocks.assertCanRequestConnection,
}));
vi.mock("@/lib/auth/session", () => ({
  requireUser: mocks.requireUser,
}));
vi.mock("@/lib/db/prisma", () => ({ getPrisma: () => prisma }));
vi.mock("@/lib/logging/audit", () => ({
  writeAuditLog: mocks.writeAuditLog,
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

import { startConversationAction } from "@/features/network/actions";

function eligibleAccount(id: string, allowMessagesFromConnections = true) {
  return {
    accountClassification: "PUBLIC_BETA_USER",
    bannedAt: null,
    deactivatedAt: null,
    id,
    isActive: true,
    messagingRestrictedUntil: null,
    profile: { allowMessagesFromConnections },
    suspendedAt: null,
    suspendedUntil: null,
  };
}

describe("direct conversation entry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue({ id: "user-b", name: "Current User" });
    mocks.writeAuditLog.mockResolvedValue(undefined);
    tx.$executeRawUnsafe.mockResolvedValue(undefined);
    tx.user.findMany.mockResolvedValue([
      eligibleAccount("user-b"),
      eligibleAccount("user-a"),
    ]);
    tx.blockedUser.findFirst.mockResolvedValue(null);
    tx.connection.findFirst.mockResolvedValue({ id: "connection-1" });
    tx.conversation.findMany.mockResolvedValue([]);
    tx.conversation.create.mockResolvedValue({ id: "conversation-new" });
  });

  it("locks the normalized pair and reuses the oldest active direct conversation", async () => {
    tx.conversation.findMany.mockResolvedValue([
      { id: "conversation-canonical", status: "ACTIVE" },
      { id: "conversation-duplicate", status: "ACTIVE" },
    ]);

    await startConversationAction("user-a");

    expect(tx.$executeRawUnsafe).toHaveBeenCalledWith(
      "SELECT pg_advisory_xact_lock(hashtext($1))",
      "user-a:user-b",
    );
    expect(tx.conversation.findMany).toHaveBeenCalledWith({
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: { id: true, status: true },
      where: {
        AND: [
          { participants: { some: { userId: "user-b" } } },
          { participants: { some: { userId: "user-a" } } },
          {
            participants: {
              every: { userId: { in: ["user-b", "user-a"] } },
            },
          },
        ],
        opportunityId: null,
      },
    });
    expect(tx.$executeRawUnsafe.mock.invocationCallOrder[0]).toBeLessThan(
      tx.conversation.findMany.mock.invocationCallOrder[0]!,
    );
    expect(tx.conversation.create).not.toHaveBeenCalled();
    expect(mocks.redirect).toHaveBeenCalledWith(
      "/app/messages/conversation-canonical",
    );
  });

  it("creates one direct conversation only after the locked canonical lookup misses", async () => {
    await startConversationAction("user-a");

    expect(tx.conversation.create).toHaveBeenCalledTimes(1);
    expect(tx.conversation.create).toHaveBeenCalledWith({
      data: {
        participants: {
          create: [{ userId: "user-b" }, { userId: "user-a" }],
        },
      },
      select: { id: true },
    });
    expect(mocks.redirect).toHaveBeenCalledWith(
      "/app/messages/conversation-new",
    );
  });

  it.each([
    ["sender", "user-b"],
    ["recipient", "user-a"],
  ])("rejects a messaging-restricted %s", async (_label, restrictedId) => {
    tx.user.findMany.mockResolvedValue([
      {
        ...eligibleAccount("user-b"),
        messagingRestrictedUntil:
          restrictedId === "user-b" ? new Date("2099-01-01") : null,
      },
      {
        ...eligibleAccount("user-a"),
        messagingRestrictedUntil:
          restrictedId === "user-a" ? new Date("2099-01-01") : null,
      },
    ]);

    await expect(startConversationAction("user-a")).rejects.toThrow(
      "Messaging is unavailable.",
    );
    expect(tx.conversation.findMany).not.toHaveBeenCalled();
  });

  it.each([
    ["a bilateral block", { block: { id: "block-1" }, connection: { id: "connection-1" } }],
    ["no accepted connection", { block: null, connection: null }],
  ])("rejects %s before conversation lookup", async (_label, policy) => {
    tx.blockedUser.findFirst.mockResolvedValue(policy.block);
    tx.connection.findFirst.mockResolvedValue(policy.connection);

    await expect(startConversationAction("user-a")).rejects.toThrow(
      "Messaging is unavailable.",
    );
    expect(tx.conversation.findMany).not.toHaveBeenCalled();
  });

  it("rejects recipient privacy and self-message attempts", async () => {
    tx.user.findMany.mockResolvedValue([
      eligibleAccount("user-b"),
      eligibleAccount("user-a", false),
    ]);

    await expect(startConversationAction("user-a")).rejects.toThrow(
      "Messaging is unavailable.",
    );
    await expect(startConversationAction("user-b")).rejects.toThrow(
      "Cannot message yourself",
    );
    expect(tx.conversation.findMany).not.toHaveBeenCalled();
  });
});
