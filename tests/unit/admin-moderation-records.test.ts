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
  getAdminMessageCasesPage,
  getAdminReportsOverview,
  getAdminReportsOverviewPage,
  getRecentBlockRows,
  getScopedMessageContext,
} from "@/lib/admin/moderation-records";
import { encodeCursor } from "@/lib/data/cursor";

describe("admin moderation records", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMocks.userFindMany.mockResolvedValue([]);
    prismaMocks.moderationMessageScopeFindFirst.mockResolvedValue({
      case: {
        reporterId: "reporter-1",
        source: "CONVERSATION_REPORT",
        targetId: "conversation-1",
        targetType: "CONVERSATION",
      },
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

  it("paginates the merged report feed with stable equal-timestamp ordering", async () => {
    const newestAt = new Date("2026-08-01T12:00:00.000Z");
    const olderAt = new Date("2026-08-01T11:00:00.000Z");
    const opportunityReport = (id: string, createdAt: Date) => ({
      createdAt,
      id,
      opportunityId: `opportunity-${id}`,
      reason: "MISLEADING",
      reporterId: "reporter-1",
      status: "OPEN",
    });
    const userReport = (id: string, createdAt: Date) => ({
      category: "HARASSMENT",
      createdAt,
      id,
      reporterId: "reporter-1",
      status: "SUBMITTED",
      targetId: `target-${id}`,
      targetType: "USER",
    });
    prismaMocks.opportunityFindMany.mockResolvedValue([]);
    prismaMocks.caseFindMany.mockResolvedValue([]);
    prismaMocks.opportunityReportFindMany
      .mockResolvedValueOnce([
        opportunityReport("report-z", newestAt),
        opportunityReport("report-l", newestAt),
        opportunityReport("report-a", olderAt),
      ])
      .mockResolvedValueOnce([
        opportunityReport("report-l", newestAt),
        opportunityReport("report-a", olderAt),
      ])
      .mockResolvedValueOnce([opportunityReport("report-a", olderAt)]);
    prismaMocks.userReportFindMany
      .mockResolvedValueOnce([
        userReport("report-m", newestAt),
        userReport("report-k", newestAt),
        userReport("report-b", olderAt),
      ])
      .mockResolvedValueOnce([
        userReport("report-k", newestAt),
        userReport("report-b", olderAt),
      ])
      .mockResolvedValueOnce([userReport("report-b", olderAt)]);

    const firstPage = await getAdminReportsOverviewPage({ pageSize: 2 });
    const secondPage = await getAdminReportsOverviewPage({
      cursor: firstPage.nextCursor ?? undefined,
      pageSize: 2,
    });
    const thirdPage = await getAdminReportsOverviewPage({
      cursor: secondPage.nextCursor ?? undefined,
      pageSize: 2,
    });

    expect(
      [firstPage, secondPage, thirdPage].flatMap((page) =>
        page.items.map((report) => report.id),
      ),
    ).toEqual([
      "report-z",
      "report-m",
      "report-l",
      "report-k",
      "report-b",
      "report-a",
    ]);
    expect(prismaMocks.opportunityReportFindMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        where: {
          AND: [
            {},
            {
              OR: [
                { createdAt: { lt: newestAt } },
                { createdAt: newestAt, id: { lt: "report-m" } },
              ],
            },
          ],
        },
      }),
    );
  });

  it("keeps active message-case filters inside a scoped cursor boundary", async () => {
    const cursor = encodeCursor({
      id: "case-m",
      scope: "admin:message-cases:active",
      timestamp: new Date("2026-08-01T12:00:00.000Z"),
    });
    prismaMocks.caseFindMany.mockResolvedValue([]);

    await getAdminMessageCasesPage({ cursor, pageSize: 2 });

    expect(prismaMocks.caseFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 3,
        where: {
          AND: [
            {
              conversationId: { not: null },
              source: {
                in: expect.arrayContaining(["MESSAGE_REPORT", "POLICY_FLAG"]),
              },
              status: { in: expect.arrayContaining(["NEW", "APPEALED"]) },
            },
            {
              OR: [
                {
                  createdAt: {
                    lt: new Date("2026-08-01T12:00:00.000Z"),
                  },
                },
                {
                  createdAt: new Date("2026-08-01T12:00:00.000Z"),
                  id: { lt: "case-m" },
                },
              ],
            },
          ],
        },
      }),
    );

    const wrongScopeCursor = encodeCursor({
      id: "case-m",
      scope: "admin:report-overview:all",
      timestamp: new Date("2026-08-01T12:00:00.000Z"),
    });
    await expect(
      getAdminMessageCasesPage({ cursor: wrongScopeCursor }),
    ).rejects.toThrow("Invalid cursor scope.");
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
      case: {
        reporterId: "reporter-1",
        source: "CONVERSATION_REPORT",
        targetId: "conversation-1",
        targetType: "CONVERSATION",
      },
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
    expect(prismaMocks.moderationMessageScopeFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          case: {
            is: expect.objectContaining({
              conversationId: "conversation-1",
              id: "case-1",
              messageId: "message-m",
              source: { in: expect.arrayContaining(["MESSAGE_REPORT"]) },
              status: { in: expect.arrayContaining(["NEW", "IN_REVIEW"]) },
            }),
          },
        }),
      }),
    );
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

  it("hides a pre-fix message report targeting the reporter's own message", async () => {
    prismaMocks.moderationMessageScopeFindFirst.mockResolvedValue({
      case: {
        reporterId: "user-1",
        source: "MESSAGE_REPORT",
        targetId: "message-m",
        targetType: "MESSAGE",
      },
      id: "scope-invalid-self-report",
      reason: "A sufficiently clear reason",
    });
    prismaMocks.conversationFindUnique.mockResolvedValue({
      id: "conversation-1",
    });
    prismaMocks.messageFindFirst.mockResolvedValue({
      body: "Reporter-owned message",
      createdAt: new Date("2026-07-31T12:00:00.000Z"),
      deletedAt: null,
      id: "message-m",
      senderId: "user-1",
    });

    await expect(
      getScopedMessageContext({
        caseId: "case-1",
        conversationId: "conversation-1",
        messageId: "message-m",
        scope: "reported-message-only",
      }),
    ).resolves.toEqual({ kind: "hidden", messages: [] });
    expect(prismaMocks.messageFindMany).not.toHaveBeenCalled();
  });
});
