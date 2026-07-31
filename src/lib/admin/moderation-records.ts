import { getPrisma } from "@/lib/db/prisma";

export const moderationCaseStatuses = [
  "NEW",
  "TRIAGED",
  "ASSIGNED",
  "IN_REVIEW",
  "NEEDS_INFORMATION",
  "ACTION_REQUIRED",
  "ESCALATED",
  "RESOLVED",
  "DISMISSED",
  "APPEALED",
  "CLOSED",
] as const;

export const messageReviewScopeOptions = [
  {
    after: 0,
    before: 0,
    label: "Reported message only",
    value: "reported-message-only",
  },
  {
    after: 2,
    before: 2,
    label: "Reported message plus 2 before and 2 after",
    value: "reported-message-2",
  },
  {
    after: 5,
    before: 5,
    label: "Reported message plus 5 before and 5 after",
    value: "reported-message-5",
  },
] as const;

export type MessageReviewScopeValue =
  (typeof messageReviewScopeOptions)[number]["value"];

export type SafeUserSummary = {
  id: string;
  isActive: boolean;
  label: string;
  name: string | null;
  username: string | null;
};

export type SafeReportRow = {
  canCreateCase: boolean;
  caseId?: string | null;
  caseStatus?: string | null;
  category: string;
  createdAt: Date;
  id: string;
  reporter: SafeUserSummary | null;
  reporterId: string;
  status: string;
  target: string;
  targetType: string;
};

export type SafeMessageRow = {
  body: string;
  createdAt: Date;
  deletedAt: Date | null;
  id: string;
  sender: SafeUserSummary | null;
  senderId: string;
};

export type ScopedMessageResult =
  | {
      kind:
        | "hidden"
        | "no-message-id"
        | "message-unavailable"
        | "conversation-unavailable";
      messages: SafeMessageRow[];
    }
  | {
      kind: "available";
      messages: SafeMessageRow[];
    };

export function formatAdminValue(value: string | null | undefined) {
  const fallback = "Unknown";
  if (!value) return fallback;
  return value.toLowerCase().replaceAll("_", " ");
}

export function safeUserLabel(
  user: SafeUserSummary | null,
  fallbackId?: string | null,
) {
  if (user?.username) return `@${user.username}`;
  if (user?.name) return user.name;
  return fallbackId
    ? `Unavailable account (${fallbackId})`
    : "Unavailable account";
}

export function normalizeMessageReviewScope(value: string | null | undefined) {
  return (
    messageReviewScopeOptions.find((option) => option.value === value) ??
    messageReviewScopeOptions[0]
  );
}

export function isMessageReviewScope(value: string | null | undefined) {
  return messageReviewScopeOptions.some((option) => option.value === value);
}

export function sourceForReportTarget(targetType: string) {
  if (targetType === "MESSAGE") return "MESSAGE_REPORT";
  if (targetType === "CONVERSATION") return "CONVERSATION_REPORT";
  if (targetType === "DEAL") return "DEAL_DISPUTE";
  if (targetType === "OPPORTUNITY" || targetType === "REAL_ESTATE_LISTING") {
    return "LISTING_REPORT";
  }
  return "USER_REPORT";
}

export function caseTitleForReport(targetType: string, category: string) {
  return `${formatAdminValue(targetType)} report: ${formatAdminValue(category)}`;
}

async function getUsersById(ids: Iterable<string>) {
  const uniqueIds = [...new Set([...ids].filter(Boolean))];
  if (!uniqueIds.length) return new Map<string, SafeUserSummary>();

  const users = await getPrisma().user.findMany({
    select: {
      id: true,
      isActive: true,
      name: true,
      username: true,
    },
    where: { id: { in: uniqueIds } },
  });

  return new Map(
    users.map((user) => [
      user.id,
      {
        id: user.id,
        isActive: user.isActive,
        label: user.username ? `@${user.username}` : user.name,
        name: user.name,
        username: user.username,
      },
    ]),
  );
}

export async function getAdminReportsOverview(): Promise<SafeReportRow[]> {
  const prisma = getPrisma();
  const [opportunityReports, userReports] = await Promise.all([
    prisma.opportunityReport.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        createdAt: true,
        id: true,
        opportunityId: true,
        reason: true,
        reporterId: true,
        status: true,
      },
      take: 50,
    }),
    prisma.userReport.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        category: true,
        createdAt: true,
        id: true,
        reporterId: true,
        status: true,
        targetId: true,
        targetType: true,
      },
      take: 50,
    }),
  ]);

  const [users, opportunities, cases] = await Promise.all([
    getUsersById([
      ...opportunityReports.map((report) => report.reporterId),
      ...userReports.map((report) => report.reporterId),
    ]),
    prisma.opportunity.findMany({
      select: { id: true, title: true },
      where: {
        id: {
          in: [
            ...new Set(
              opportunityReports.map((report) => report.opportunityId),
            ),
          ],
        },
      },
    }),
    prisma.moderationCase.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        linkedOpportunityReportId: true,
        linkedReportId: true,
        status: true,
      },
      where: {
        OR: [
          { linkedReportId: { in: userReports.map((report) => report.id) } },
          {
            linkedOpportunityReportId: {
              in: opportunityReports.map((report) => report.id),
            },
          },
        ],
      },
    }),
  ]);

  const opportunitiesById = new Map(
    opportunities.map((item) => [item.id, item]),
  );
  const caseByReportId = new Map<string, (typeof cases)[number]>();
  for (const moderationCase of cases) {
    const reportId =
      moderationCase.linkedReportId ?? moderationCase.linkedOpportunityReportId;
    if (reportId && !caseByReportId.has(reportId)) {
      caseByReportId.set(reportId, moderationCase);
    }
  }

  return [
    ...opportunityReports.map((report) => {
      const moderationCase = caseByReportId.get(report.id);
      return {
        canCreateCase: false,
        caseId: moderationCase?.id ?? null,
        caseStatus: moderationCase?.status ?? null,
        category: report.reason,
        createdAt: report.createdAt,
        id: report.id,
        reporter: users.get(report.reporterId) ?? null,
        reporterId: report.reporterId,
        status: mapOpportunityReportStatus(report.status),
        target:
          opportunitiesById.get(report.opportunityId)?.title ??
          `Unavailable opportunity (${report.opportunityId})`,
        targetType: "OPPORTUNITY",
      };
    }),
    ...userReports.map((report) => {
      const moderationCase = caseByReportId.get(report.id);
      return {
        canCreateCase:
          !moderationCase &&
          (report.status === "SUBMITTED" || report.status === "IN_REVIEW"),
        caseId: moderationCase?.id ?? null,
        caseStatus: moderationCase?.status ?? null,
        category: report.category,
        createdAt: report.createdAt,
        id: report.id,
        reporter: users.get(report.reporterId) ?? null,
        reporterId: report.reporterId,
        status: report.status,
        target: report.targetId,
        targetType: report.targetType,
      };
    }),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export async function getRecentBlockRows() {
  const blocks = await getPrisma().blockedUser.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      blockedUserId: true,
      blockerUserId: true,
      createdAt: true,
      id: true,
      reason: true,
    },
    take: 25,
  });
  const users = await getUsersById(
    blocks.flatMap((block) => [block.blockerUserId, block.blockedUserId]),
  );
  return blocks.map((block) => ({
    ...block,
    blockedUser: users.get(block.blockedUserId) ?? null,
    blocker: users.get(block.blockerUserId) ?? null,
  }));
}

export async function getAdminMessageCases() {
  const cases = await getPrisma().moderationCase.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      category: true,
      conversationId: true,
      createdAt: true,
      id: true,
      linkedReportId: true,
      messageId: true,
      priority: true,
      reportedUserId: true,
      reporterId: true,
      source: true,
      status: true,
      summary: true,
      targetId: true,
      targetType: true,
      title: true,
      messageScopes: {
        orderBy: { createdAt: "desc" },
        select: {
          conversationId: true,
          createdAt: true,
          id: true,
          messageId: true,
          reason: true,
          scope: true,
        },
        take: 10,
      },
    },
    take: 50,
    where: {
      conversationId: { not: null },
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

  const linkedReportIds = cases
    .map((moderationCase) => moderationCase.linkedReportId)
    .filter((id): id is string => Boolean(id));
  const linkedReports = linkedReportIds.length
    ? await getPrisma().userReport.findMany({
        select: {
          category: true,
          createdAt: true,
          id: true,
          reporterId: true,
        },
        where: { id: { in: linkedReportIds } },
      })
    : [];
  const users = await getUsersById([
    ...cases.map((moderationCase) => moderationCase.reporterId ?? ""),
    ...cases.map((moderationCase) => moderationCase.reportedUserId ?? ""),
    ...linkedReports.map((report) => report.reporterId),
  ]);
  const reportsById = new Map(
    linkedReports.map((report) => [report.id, report]),
  );

  return cases.map((moderationCase) => {
    const linkedReport = moderationCase.linkedReportId
      ? reportsById.get(moderationCase.linkedReportId)
      : null;
    const reporterId = linkedReport?.reporterId ?? moderationCase.reporterId;
    const messageScopes = moderationCase.messageScopes
      .filter(
        (scope) =>
          scope.conversationId === moderationCase.conversationId &&
          scope.messageId === moderationCase.messageId &&
          isMessageReviewScope(scope.scope),
      )
      .slice(0, 1);
    return {
      ...moderationCase,
      linkedReport,
      messageScopes,
      reportedUser: moderationCase.reportedUserId
        ? (users.get(moderationCase.reportedUserId) ?? null)
        : null,
      reporter: reporterId ? (users.get(reporterId) ?? null) : null,
      reporterId,
    };
  });
}

export async function getScopedMessageContext({
  conversationId,
  messageId,
  scope,
}: {
  conversationId: string | null;
  messageId: string | null;
  scope?: string | null;
}): Promise<ScopedMessageResult> {
  if (!conversationId)
    return { kind: "conversation-unavailable", messages: [] };
  if (!messageId) return { kind: "no-message-id", messages: [] };

  const normalizedScope = messageReviewScopeOptions.find(
    (option) => option.value === scope,
  );
  if (!normalizedScope) return { kind: "hidden", messages: [] };

  const conversation = await getPrisma().conversation.findUnique({
    select: { id: true },
    where: { id: conversationId },
  });
  if (!conversation) return { kind: "conversation-unavailable", messages: [] };

  const reportedMessage = await getPrisma().message.findFirst({
    select: {
      body: true,
      createdAt: true,
      deletedAt: true,
      id: true,
      senderId: true,
    },
    where: { conversationId, id: messageId },
  });
  if (!reportedMessage) return { kind: "message-unavailable", messages: [] };
  const [before, after] = await Promise.all([
    normalizedScope.before
      ? getPrisma().message.findMany({
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          select: {
            body: true,
            createdAt: true,
            deletedAt: true,
            id: true,
            senderId: true,
          },
          take: normalizedScope.before,
          where: {
            conversationId,
            OR: [
              { createdAt: { lt: reportedMessage.createdAt } },
              {
                createdAt: reportedMessage.createdAt,
                id: { lt: reportedMessage.id },
              },
            ],
          },
        })
      : [],
    normalizedScope.after
      ? getPrisma().message.findMany({
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          select: {
            body: true,
            createdAt: true,
            deletedAt: true,
            id: true,
            senderId: true,
          },
          take: normalizedScope.after,
          where: {
            conversationId,
            OR: [
              { createdAt: { gt: reportedMessage.createdAt } },
              {
                createdAt: reportedMessage.createdAt,
                id: { gt: reportedMessage.id },
              },
            ],
          },
        })
      : [],
  ]);

  const rows = [...before.reverse(), reportedMessage, ...after];
  const users = await getUsersById(rows.map((message) => message.senderId));

  return {
    kind: "available",
    messages: rows.map((message) => ({
      ...message,
      sender: users.get(message.senderId) ?? null,
    })),
  };
}

export async function getAdminModerationCase(caseId: string) {
  const moderationCase = await getPrisma().moderationCase.findUnique({
    select: {
      category: true,
      conversationId: true,
      createdAt: true,
      enforcementActions: {
        orderBy: { createdAt: "desc" },
        select: {
          appealAllowed: true,
          createdAt: true,
          expiresAt: true,
          id: true,
          status: true,
          targetUserId: true,
          type: true,
        },
        take: 10,
      },
      events: {
        orderBy: { createdAt: "desc" },
        select: {
          createdAt: true,
          id: true,
          nextStatus: true,
          previousStatus: true,
          type: true,
        },
        take: 20,
      },
      id: true,
      linkedReportId: true,
      messageId: true,
      messageScopes: {
        orderBy: { createdAt: "desc" },
        select: {
          conversationId: true,
          createdAt: true,
          id: true,
          messageId: true,
          reason: true,
          scope: true,
        },
        take: 10,
      },
      priority: true,
      reportedUserId: true,
      reporterId: true,
      source: true,
      status: true,
      summary: true,
      targetId: true,
      targetType: true,
      title: true,
    },
    where: { id: caseId },
  });
  if (!moderationCase) return null;

  const linkedReport = moderationCase.linkedReportId
    ? await getPrisma().userReport.findUnique({
        select: {
          category: true,
          createdAt: true,
          id: true,
          reporterId: true,
          status: true,
        },
        where: { id: moderationCase.linkedReportId },
      })
    : null;

  const users = await getUsersById([
    moderationCase.reporterId ?? "",
    moderationCase.reportedUserId ?? "",
    linkedReport?.reporterId ?? "",
    ...moderationCase.enforcementActions.map((action) => action.targetUserId),
  ]);

  const reporterId = linkedReport?.reporterId ?? moderationCase.reporterId;
  const messageScopes = moderationCase.messageScopes
    .filter(
      (scope) =>
        scope.conversationId === moderationCase.conversationId &&
        scope.messageId === moderationCase.messageId &&
        isMessageReviewScope(scope.scope),
    )
    .slice(0, 1);
  return {
    ...moderationCase,
    linkedReport,
    messageScopes,
    reportedUser: moderationCase.reportedUserId
      ? (users.get(moderationCase.reportedUserId) ?? null)
      : null,
    reporter: reporterId ? (users.get(reporterId) ?? null) : null,
    reporterId,
  };
}

function mapOpportunityReportStatus(status: string) {
  if (status === "OPEN") return "SUBMITTED";
  if (status === "REVIEWING") return "IN_REVIEW";
  if (status === "ACTIONED") return "ACTION_TAKEN";
  if (status === "DISMISSED") return "DISMISSED";
  return "Legacy status";
}
