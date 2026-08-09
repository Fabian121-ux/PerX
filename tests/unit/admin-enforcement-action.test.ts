import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireCapabilityOrNotFound: vi.fn(),
}));

const tx = vi.hoisted(() => ({
  $executeRawUnsafe: vi.fn(),
  auditLog: { create: vi.fn() },
  enforcementAction: { create: vi.fn() },
  message: { findFirst: vi.fn() },
  moderationCase: { findFirst: vi.fn(), updateMany: vi.fn() },
  moderationCaseEvent: { create: vi.fn() },
  session: { deleteMany: vi.fn() },
  user: { findUnique: vi.fn(), update: vi.fn() },
}));

const prisma = vi.hoisted(() => ({
  $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({
  requireCapabilityOrNotFound: mocks.requireCapabilityOrNotFound,
}));
vi.mock("@/lib/db/prisma", () => ({ getPrisma: () => prisma }));
vi.mock("@/lib/logging/audit", () => ({ writeAuditLog: vi.fn() }));
vi.mock("@/lib/notifications/action-url", () => ({
  normalizeNotificationActionUrl: vi.fn(),
}));

import { applyEnforcementAction } from "@/features/admin/actions";

function enforcementFormData() {
  const formData = new FormData();
  formData.set("caseId", "case-1");
  formData.set("internalNote", "Internal enforcement rationale.");
  formData.set("reason", "Documented policy violation.");
  formData.set("targetUserId", "user-2");
  formData.set("type", "WARNING");
  formData.set("userFacingExplanation", "A policy warning was issued.");
  return formData;
}

describe("admin enforcement actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireCapabilityOrNotFound.mockResolvedValue({ id: "admin-1" });
    tx.moderationCase.updateMany.mockResolvedValue({ count: 1 });
  });

  it("quarantines a persisted self-authored message report before enforcement", async () => {
    tx.moderationCase.findFirst.mockResolvedValue({
      conversationId: "conversation-1",
      messageId: "message-1",
      reportedUserId: "user-2",
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

    await expect(applyEnforcementAction(enforcementFormData())).rejects.toThrow(
      "Reported message target unavailable.",
    );

    expect(tx.$executeRawUnsafe).toHaveBeenCalledWith(
      "SELECT pg_advisory_xact_lock(hashtext($1))",
      "account:user-2",
    );
    expect(tx.enforcementAction.create).not.toHaveBeenCalled();
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it("does not enforce when the active case claim loses a status race", async () => {
    tx.moderationCase.findFirst.mockResolvedValue({
      conversationId: null,
      messageId: null,
      reportedUserId: "user-2",
      reporterId: "user-1",
      source: "USER_REPORT",
      status: "NEW",
      targetId: "user-2",
      targetType: "USER",
    });
    tx.moderationCase.updateMany.mockResolvedValue({ count: 0 });

    await expect(applyEnforcementAction(enforcementFormData())).rejects.toThrow(
      "Case is not eligible for enforcement.",
    );

    expect(tx.user.findUnique).not.toHaveBeenCalled();
    expect(tx.enforcementAction.create).not.toHaveBeenCalled();
  });
});
