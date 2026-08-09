import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireCapabilityOrNotFound: vi.fn(),
  revalidatePath: vi.fn(),
}));

const tx = vi.hoisted(() => ({
  auditLog: { create: vi.fn() },
  message: { findFirst: vi.fn() },
  moderationCase: { findFirst: vi.fn(), updateMany: vi.fn() },
  moderationCaseEvent: { create: vi.fn() },
  moderationMessageScope: { create: vi.fn() },
}));

const prisma = vi.hoisted(() => ({
  $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/auth/session", () => ({
  requireCapabilityOrNotFound: mocks.requireCapabilityOrNotFound,
}));
vi.mock("@/lib/db/prisma", () => ({ getPrisma: () => prisma }));
vi.mock("@/lib/logging/audit", () => ({ writeAuditLog: vi.fn() }));
vi.mock("@/lib/notifications/action-url", () => ({
  normalizeNotificationActionUrl: vi.fn(),
}));

import { recordMessageScopeRevealAction } from "@/features/admin/actions";

function revealFormData() {
  const formData = new FormData();
  formData.set("caseId", "case-1");
  formData.set("confirmScope", "on");
  formData.set("reason", "Reviewing the reported message context.");
  formData.set("scope", "reported-message-only");
  return formData;
}

describe("admin message scope actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireCapabilityOrNotFound.mockResolvedValue({ id: "admin-1" });
    tx.moderationCase.updateMany.mockResolvedValue({ count: 1 });
  });

  it("rejects a case that is no longer eligible inside the transaction", async () => {
    tx.moderationCase.findFirst.mockResolvedValue(null);

    await expect(recordMessageScopeRevealAction(revealFormData())).rejects.toThrow(
      "Message content can only be revealed from an active linked case.",
    );

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.message.findFirst).not.toHaveBeenCalled();
    expect(tx.moderationMessageScope.create).not.toHaveBeenCalled();
  });

  it("creates the evidence scope only from the transaction-validated linkage", async () => {
    tx.moderationCase.findFirst.mockResolvedValue({
      conversationId: "conversation-1",
      id: "case-1",
      messageId: "message-1",
      reporterId: "user-2",
      source: "MESSAGE_REPORT",
      status: "NEW",
      targetId: "message-1",
      targetType: "MESSAGE",
    });
    tx.message.findFirst.mockResolvedValue({
      id: "message-1",
      senderId: "user-1",
    });

    await recordMessageScopeRevealAction(revealFormData());

    expect(tx.moderationCase.findFirst).toHaveBeenCalledWith({
      select: {
        conversationId: true,
        id: true,
        messageId: true,
        reporterId: true,
        source: true,
        status: true,
        targetId: true,
        targetType: true,
      },
      where: {
        conversationId: { not: null },
        id: "case-1",
        messageId: { not: null },
        source: {
          in: [
            "MESSAGE_REPORT",
            "CONVERSATION_REPORT",
            "POLICY_FLAG",
            "SUPPORT_CASE",
            "SECURITY_INVESTIGATION",
          ],
        },
        status: {
          in: [
            "NEW",
            "TRIAGED",
            "ASSIGNED",
            "IN_REVIEW",
            "NEEDS_INFORMATION",
            "ACTION_REQUIRED",
            "ESCALATED",
            "APPEALED",
          ],
        },
      },
    });
    expect(tx.message.findFirst).toHaveBeenCalledWith({
      select: { id: true, senderId: true },
      where: { conversationId: "conversation-1", id: "message-1" },
    });
    expect(tx.moderationMessageScope.create).toHaveBeenCalledWith({
      data: {
        caseId: "case-1",
        conversationId: "conversation-1",
        messageId: "message-1",
        reason: "Reviewing the reported message context.",
        revealedById: "admin-1",
        scope: "reported-message-only",
      },
    });
  });

  it("does not reveal evidence when eligibility changes before the claim", async () => {
    tx.moderationCase.findFirst.mockResolvedValue({
      conversationId: "conversation-1",
      id: "case-1",
      messageId: "message-1",
      reporterId: "user-2",
      source: "MESSAGE_REPORT",
      status: "NEW",
      targetId: "message-1",
      targetType: "MESSAGE",
    });
    tx.moderationCase.updateMany.mockResolvedValue({ count: 0 });

    await expect(recordMessageScopeRevealAction(revealFormData())).rejects.toThrow(
      "Message content can only be revealed from an active linked case.",
    );

    expect(tx.message.findFirst).not.toHaveBeenCalled();
    expect(tx.moderationMessageScope.create).not.toHaveBeenCalled();
  });

  it("rejects a pre-fix case against the reporter's own message", async () => {
    tx.moderationCase.findFirst.mockResolvedValue({
      conversationId: "conversation-1",
      id: "case-1",
      messageId: "message-1",
      reporterId: "user-1",
      source: "MESSAGE_REPORT",
      status: "NEW",
      targetId: "message-1",
      targetType: "MESSAGE",
    });
    tx.message.findFirst.mockResolvedValue({
      id: "message-1",
      senderId: "user-1",
    });

    await expect(recordMessageScopeRevealAction(revealFormData())).rejects.toThrow(
      "Reported message unavailable.",
    );
    expect(tx.moderationMessageScope.create).not.toHaveBeenCalled();
  });
});
