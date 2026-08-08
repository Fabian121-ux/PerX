import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMocks = vi.hoisted(() => ({
  blockFindMany: vi.fn(),
  caseFindMany: vi.fn(),
  conversationFindUnique: vi.fn(),
  messageFindFirst: vi.fn(),
  messageFindMany: vi.fn(),
  moderationMessageScopeFindFirst: vi.fn(),
  opportunityFindMany: vi.fn(),
  opportunityReportFindMany: vi.fn(),
  userFindMany: vi.fn(),
  userReportFindMany: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  getPrisma: () => ({
    blockedUser: { findMany: prismaMocks.blockFindMany },
    conversation: { findUnique: prismaMocks.conversationFindUnique },
    message: {
      findFirst: prismaMocks.messageFindFirst,
      findMany: prismaMocks.messageFindMany,
    },
    moderationMessageScope: {
      findFirst: prismaMocks.moderationMessageScopeFindFirst,
    },
    moderationCase: { findMany: prismaMocks.caseFindMany },
    opportunity: { findMany: prismaMocks.opportunityFindMany },
    opportunityReport: { findMany: prismaMocks.opportunityReportFindMany },
    user: { findMany: prismaMocks.userFindMany },
    userReport: { findMany: prismaMocks.userReportFindMany },
  }),
}));

import {
  getAdminMessageCases,
  getAdminReportsOverview,
  getRecentBlockRows,
  getScopedMessageContext,
} from "@/lib/admin/moderation-records";

describe("admin moderation records", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMocks.userFindMany.mockResolvedValue([]);
    prismaMocks.moderationMessageScopeFindFirst.mockResolvedValue({
      id: "scope-authorized",
      reason: "A sufficiently clear reason",
    });
  });

  it("renders report and block metadata when related users or targets are unavailable", async () => {
    const now = new Date("2026-07-31T12:00:00.000Z");
    prismaMocks.opportunityReportFindMany.mockResolvedValue([
      {
        createdAt: now,
        id: "opportunity-report-1",
        opportunityId: "missing-opportunity",
        reason: "MISLEADING",
        reporterId: "missing-reporter",
        status: "OPEN",
      },
    ]);
    prismaMocks.userReportFindMany.mockResolvedValue([
      {
        category: "HARASSMENT",
        createdAt: new Date(now.getTime() - 1_000),
        id: "user-report-1",
        reporterId: "missing-reporter",
        status: "SUBMITTED",
        targetId: "missing-user",
        targetType: "USER",
      },
    ]);
    prismaMocks.opportunityFindMany.mockResolvedValue([]);
    prismaMocks.caseFindMany.mockResolvedValue([]);
    prismaMocks.blockFindMany.mockResolvedValue([
      {
        blockedUserId: "missing-blocked",
        blockerUserId: "missing-blocker",
        createdAt: now,
        id: "block-1",
        reason: null,
      },
    ]);

    const [reports, blocks] = await Promise.all([
      getAdminReportsOverview(),
      getRecentBlockRows(),
    ]);

    expect(reports).toMatchObject([
      {
        canCreateCase: false,
        reporter: null,
        target: "Unavailable opportunity (missing-opportunity)",
      },
      {
        canCreateCase: true,
        reporter: null,
        target: "missing-user",
      },
    ]);
    expect(blocks[0]).toMatchObject({ blockedUser: null, blocker: null });
  });

  it("uses only an allowlisted scope tied to the exact case evidence", async () => {
    prismaMocks.caseFindMany.mockResolvedValue([
      {
        category: "HARASSMENT",
        conversationId: "conversation-1",
        createdAt: new Date(),
        id: "case-1",
        linkedReportId: null,
        messageId: "message-1",
        messageScopes: [
          {
            conversationId: "conversation-2",
            createdAt: new Date(),
            id: "scope-wrong-conversation",
            messageId: "message-1",
            reason: "A sufficiently clear reason",
            scope: "reported-message-5",
          },
          {
            conversationId: "conversation-1",
            createdAt: new Date(),
            id: "scope-unknown",
            messageId: "message-1",
            reason: "A sufficiently clear reason",
            scope: "all-messages",
          },
          {
            conversationId: "conversation-1",
            createdAt: new Date(),
            id: "scope-valid",
            messageId: "message-1",
            reason: "A sufficiently clear reason",
            scope: "reported-message-2",
          },
        ],
        priority: "NORMAL",
        reportedUserId: null,
        reporterId: null,
        source: "MESSAGE_REPORT",
        status: "NEW",
        summary: "Summary",
        targetId: "message-1",
        targetType: "MESSAGE",
        title: "Message report",
      },
    ]);
    prismaMocks.userReportFindMany.mockResolvedValue([]);

    const cases = await getAdminMessageCases();

    expect(cases[0].messageScopes).toHaveLength(1);
    expect(cases[0].messageScopes[0].id).toBe("scope-valid");
  });

  it("keeps admin case listing metadata-only without eager message evidence", async () => {
    prismaMocks.caseFindMany.mockResolvedValue([
      {
        category: "HARASSMENT",
        conversationId: "conversation-1",
        createdAt: new Date(),
        id: "case-1",
        linkedReportId: null,
        messageId: "message-1",
        messageScopes: [],
        priority: "NORMAL",
        reportedUserId: null,
        reporterId: null,
        source: "MESSAGE_REPORT",
        status: "NEW",
        summary: "Summary",
        targetId: "message-1",
        targetType: "MESSAGE",
        title: "Message report",
      },
    ]);

    const cases = await getAdminMessageCases();

    expect(cases).toHaveLength(1);
    expect(prismaMocks.conversationFindUnique).not.toHaveBeenCalled();
    expect(prismaMocks.messageFindFirst).not.toHaveBeenCalled();
    expect(prismaMocks.messageFindMany).not.toHaveBeenCalled();
  });

  it("does not query private evidence for an unknown stored scope", async () => {
    const result = await getScopedMessageContext({
      caseId: "case-1",
      conversationId: "conversation-1",
      messageId: "message-1",
      scope: "all-messages",
    });

    expect(result).toEqual({ kind: "hidden", messages: [] });
    expect(prismaMocks.conversationFindUnique).not.toHaveBeenCalled();
    expect(prismaMocks.messageFindFirst).not.toHaveBeenCalled();
  });

  it("does not query private evidence when the stored reason is insufficient", async () => {
    prismaMocks.moderationMessageScopeFindFirst.mockResolvedValue({
      id: "scope-short-reason",
      reason: "too short",
    });

    const result = await getScopedMessageContext({
      caseId: "case-1",
      conversationId: "conversation-1",
      messageId: "message-1",
      scope: "reported-message-only",
    });

    expect(result).toEqual({ kind: "hidden", messages: [] });
    expect(prismaMocks.conversationFindUnique).not.toHaveBeenCalled();
    expect(prismaMocks.messageFindFirst).not.toHaveBeenCalled();
  });

  it("limits message context with deterministic timestamp and id boundaries", async () => {
    const createdAt = new Date("2026-07-31T12:00:00.000Z");
    prismaMocks.conversationFindUnique.mockResolvedValue({
      id: "conversation-1",
    });
    prismaMocks.messageFindFirst.mockResolvedValue({
      body: "Reported",
      createdAt,
      deletedAt: null,
      id: "message-m",
      senderId: "user-1",
    });
    prismaMocks.messageFindMany.mockResolvedValue([]);

    const result = await getScopedMessageContext({
      caseId: "case-1",
      conversationId: "conversation-1",
      messageId: "message-m",
      scope: "reported-message-2",
    });

    expect(result.kind).toBe("available");
    expect(prismaMocks.messageFindMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        take: 2,
        where: {
          conversationId: "conversation-1",
          OR: [
            { createdAt: { lt: createdAt } },
            { createdAt, id: { lt: "message-m" } },
          ],
        },
      }),
    );
    expect(prismaMocks.messageFindMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        take: 2,
        where: {
          conversationId: "conversation-1",
          OR: [
            { createdAt: { gt: createdAt } },
            { createdAt, id: { gt: "message-m" } },
          ],
        },
      }),
    );
  });
});
