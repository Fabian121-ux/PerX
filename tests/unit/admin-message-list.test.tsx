import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAdminMessageCasesPage: vi.fn(),
  getScopedMessageContext: vi.fn(),
  requireCapabilityOrNotFound: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  requireCapabilityOrNotFound: mocks.requireCapabilityOrNotFound,
}));
vi.mock("@/lib/admin/moderation-records", () => ({
  formatAdminValue: (value: string | null | undefined) => value ?? "Unknown",
  getAdminMessageCasesPage: mocks.getAdminMessageCasesPage,
  getScopedMessageContext: mocks.getScopedMessageContext,
  messageReviewScopeOptions: [
    { after: 0, before: 0, label: "Reported message only", value: "reported-message-only" },
  ],
  moderationCaseStatuses: ["NEW"],
  safeUserLabel: () => "@reporter",
}));
vi.mock("@/features/admin/actions", () => ({
  applyEnforcementAction: vi.fn(),
  recordMessageScopeRevealAction: vi.fn(),
  updateModerationCaseStatusAction: vi.fn(),
}));

import AdminMessagesPage from "@/app/admin/messages/page";

describe("admin message list evidence loading", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireCapabilityOrNotFound.mockResolvedValue(undefined);
    mocks.getAdminMessageCasesPage.mockResolvedValue({
      cursor: null,
      items: [{
        category: "HARASSMENT",
        conversationId: "conversation-1",
        createdAt: new Date("2026-08-01T12:00:00.000Z"),
        id: "case-1",
        messageId: "message-1",
        messageScopes: [
          {
            scope: "reported-message-only",
          },
        ],
        reportedUserId: null,
        reporter: null,
        reporterId: "reporter-1",
        source: "MESSAGE_REPORT",
        status: "NEW",
        title: "Message report",
      }],
      nextCursor: null,
      pageSize: 20,
    });
  });

  it("does not load private evidence while rendering the case list", async () => {
    await AdminMessagesPage({ searchParams: Promise.resolve({}) });

    expect(mocks.getScopedMessageContext).not.toHaveBeenCalled();
  });
});
