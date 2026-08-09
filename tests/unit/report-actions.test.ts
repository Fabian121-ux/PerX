import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  assertAccountAccess: vi.fn(),
  redirect: vi.fn((url: string): never => {
    throw new Error(`REDIRECT:${url}`);
  }),
  requireUser: vi.fn(),
  writeAuditLog: vi.fn(),
}));

const tx = vi.hoisted(() => ({
  $executeRawUnsafe: vi.fn(),
  auditLog: { create: vi.fn() },
  blockedUser: { upsert: vi.fn() },
  connection: { updateMany: vi.fn() },
  moderationCase: { create: vi.fn() },
  userReport: { create: vi.fn() },
}));

const prisma = vi.hoisted(() => ({
  $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
  message: { findFirst: vi.fn() },
  user: { findFirst: vi.fn() },
  userReport: { findFirst: vi.fn() },
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/account/enforcement", () => ({
  assertAccountAccess: mocks.assertAccountAccess,
}));
vi.mock("@/lib/auth/session", () => ({ requireUser: mocks.requireUser }));
vi.mock("@/lib/db/prisma", () => ({ getPrisma: () => prisma }));
vi.mock("@/lib/logging/audit", () => ({ writeAuditLog: mocks.writeAuditLog }));

import { submitUserReportAction } from "@/features/reports/actions";

describe("user report actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue({ id: "user-1" });
    mocks.assertAccountAccess.mockResolvedValue(null);
    prisma.user.findFirst.mockResolvedValue({ id: "user-2" });
    prisma.userReport.findFirst.mockResolvedValue(null);
    tx.userReport.create.mockResolvedValue({ id: "report-1" });
    tx.moderationCase.create.mockResolvedValue({ id: "case-1" });
  });

  it("discards forged message context for a user report", async () => {
    const formData = new FormData();
    formData.set("category", "HARASSMENT");
    formData.set("targetId", "user-2");
    formData.set("targetType", "USER");
    formData.set("contextConversationId", "ck8e6ot4h0000et9u5qg9q6e8");
    formData.set("contextMessageId", "ck8e6ot4h0001et9u5qg9q6e9");

    await expect(submitUserReportAction(formData)).rejects.toThrow(
      "REDIRECT:/app/reports?submitted=1",
    );

    expect(tx.userReport.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        contextConversationId: null,
        contextMessageId: null,
        reporterId: "user-1",
        targetId: "user-2",
        targetType: "USER",
      }),
      select: { id: true },
    });
    expect(tx.moderationCase.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        conversationId: null,
        messageId: null,
        reportedUserId: "user-2",
        targetId: "user-2",
        targetType: "USER",
      }),
      select: { id: true },
    });
  });

  it("rejects a report against the reporter's own message", async () => {
    prisma.message.findFirst.mockResolvedValue({
      conversation: {
        participants: [{ userId: "user-1" }, { userId: "user-2" }],
      },
      conversationId: "conversation-1",
      id: "ck8e6ot4h0001et9u5qg9q6e9",
      senderId: "user-1",
    });
    const formData = new FormData();
    formData.set("category", "HARASSMENT");
    formData.set("targetId", "ck8e6ot4h0001et9u5qg9q6e9");
    formData.set("targetType", "MESSAGE");

    await expect(submitUserReportAction(formData)).rejects.toThrow(
      "REDIRECT:/app/reports/new?error=unavailable",
    );

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("serializes report-and-block with messaging for the same user pair", async () => {
    const formData = new FormData();
    formData.set("blockAfterReport", "on");
    formData.set("category", "HARASSMENT");
    formData.set("targetId", "user-2");
    formData.set("targetType", "USER");

    await expect(submitUserReportAction(formData)).rejects.toThrow(
      "REDIRECT:/app/reports?submitted=1",
    );

    expect(tx.$executeRawUnsafe).toHaveBeenCalledWith(
      "SELECT pg_advisory_xact_lock(hashtext($1))",
      "user-1:user-2",
    );
    expect(tx.blockedUser.upsert).toHaveBeenCalled();
    expect(tx.$executeRawUnsafe.mock.invocationCallOrder[0]).toBeLessThan(
      tx.blockedUser.upsert.mock.invocationCallOrder[0]!,
    );
  });
});
