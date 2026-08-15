import { getPrisma } from "@/lib/db/prisma";
import {
  createCursorPage,
  normalizeCursorPageParams,
  withCursor,
  type CursorPageParams,
} from "@/lib/data/cursor";
import type { Prisma } from "@/generated/prisma/client";

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

export const messageModerationCaseSources = [
  "MESSAGE_REPORT",
  "CONVERSATION_REPORT",
  "POLICY_FLAG",
  "SUPPORT_CASE",
  "SECURITY_INVESTIGATION",
] as const;

export const activeMessageModerationCaseStatuses = [
  "NEW",
  "TRIAGED",
  "ASSIGNED",
  "IN_REVIEW",
  "NEEDS_INFORMATION",
  "ACTION_REQUIRED",
  "ESCALATED",
  "APPEALED",
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

export async function getAdminReportsOverviewPage(
  params?: CursorPageParams,
) {
  const scope = "admin:report-overview:all";
  const { cursor, pageSize, requestedCursor } = normalizeCursorPageParams(
    params,
    scope,
  );
  const prisma = getPrisma();
  const [opportunityReports, userReports] = await Promise.all([
    prisma.opportunityReport.findMany({
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: {
        createdAt: true,
        id: true,
        opportunityId: true,
        reason: true,
        reporterId: true,
        status: true,
      },
      take: pageSize + 1,
      where: withCursor<Prisma.OpportunityReportWhereInput>({}, cursor, {
        direction: "desc",
        field: "createdAt",
      }),
    }),
    prisma.userReport.findMany({
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: {
        category: true,
        createdAt: true,
        id: true,
        reporterId: true,
        status: true,
        targetId: true,
        targetType: true,
      },
      take: pageSize + 1,
      where: withCursor<Prisma.UserReportWhereInput>({}, cursor, {
        direction: "desc",
        field: "createdAt",
      }),
    }),
  ]);

  const mergedReports = [
    ...opportunityReports.map((report) => ({
      kind: "opportunity" as const,
      report,
    })),
    ...userReports.map((report) => ({ kind: "user" as const, report })),
  ].sort((left, right) => {
    const timeDifference =
      right.report.createdAt.getTime() - left.report.createdAt.getTime();
    return timeDifference || right.report.id.localeCompare(left.report.id);
  });
  const hasNextPage = mergedReports.length > pageSize;
  const selectedReports = hasNextPage
    ? mergedReports.slice(0, pageSize)
    : mergedReports;
  const selectedOpportunityReports = selectedReports.flatMap((item) =>
    item.kind === "opportunity" ? [item.report] : [],
  );
  const selectedUserReports = selectedReports.flatMap((item) =>
    item.kind === "user" ? [item.report] : [],
  );

  const [users, opportunities, cases] = await Promise.all([
    getUsersById([
      ...selectedOpportunityReports.map((report) => report.reporterId),
      ...selectedUserReports.map((report) => report.reporterId),
    ]),
    prisma.opportunity.findMany({
      select: { id: true, title: true },
      where: {
        id: {
          in: [
            ...new Set(
              selectedOpportunityReports.map((report) => report.opportunityId),
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
          {
            linkedReportId: {
              in: selectedUserReports.map((report) => report.id),
            },
          },
          {
            linkedOpportunityReportId: {
              in: selectedOpportunityReports.map((report) => report.id),
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

  const items = selectedReports.map((item): SafeReportRow => {
    if (item.kind === "opportunity") {
      const report = item.report;
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
    }

    const report = item.report;
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
  });

  return createCursorPage(items, {
    cursor: requestedCursor,
    getTimestamp: (item) => item.createdAt,
    hasNextPage,
    pageSize,
    scope,
  });
}

export async function getAdminReportsOverview(): Promise<SafeReportRow[]> {
  return (await getAdminReportsOverviewPage({ pageSize: 50 })).items;
}

export async function getRecentBlockRows() {
  const blocks = await getPrisma().blockedUser.findMany({
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
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

export async function getAdminMessageCasesPage(params?: CursorPageParams) {
  const scope = "admin:message-cases:active";
  const { cursor, pageSize, requestedCursor } = normalizeCursorPageParams(
    params,
    scope,
  );
  const rows = await getPrisma().moderationCase.findMany({
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
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
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
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
    take: pageSize + 1,
    where: withCursor<Prisma.ModerationCaseWhereInput>(
      {
        conversationId: { not: null },
        source: { in: [...messageModerationCaseSources] },
        status: { in: [...activeMessageModerationCaseStatuses] },
      },
      cursor,
      { direction: "desc", field: "createdAt" },
    ),
  });
  const hasNextPage = rows.length > pageSize;
  const cases = hasNextPage ? rows.slice(0, pageSize) : rows;

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

  const items = cases.map((moderationCase) => {
    const linkedReport = moderationCase.linkedReportId
      ? reportsById.get(moderationCase.linkedReportId)
      : null;
    const reporterId = linkedReport?.reporterId ?? moderationCase.reporterId;
    const messageScopes = moderationCase.messageScopes
      .filter(
        (scope) =>
          scope.conversationId === moderationCase.conversationId &&
          scope.messageId === moderationCase.messageId &&
          isMessageReviewScope(scope.scope) &&
          scope.reason.trim().length >= 12,
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

  return createCursorPage(items, {
    cursor: requestedCursor,
    getTimestamp: (item) => item.createdAt,
    hasNextPage,
    pageSize,
    scope,
  });
}

export async function getAdminMessageCases() {
  return (await getAdminMessageCasesPage({ pageSize: 50 })).items;
}

export async function getScopedMessageContext({
  caseId,
  conversationId,
  messageId,
  scope,
}: {
  caseId: string;
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

  const authorizedScope = await getPrisma().moderationMessageScope.findFirst({
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: {
      case: {
        select: {
          reporterId: true,
          source: true,
          targetId: true,
          targetType: true,
        },
      },
      id: true,
      reason: true,
    },
    where: {
      case: {
        is: {
          conversationId,
          id: caseId,
          messageId,
          source: { in: [...messageModerationCaseSources] },
          status: { in: [...activeMessageModerationCaseStatuses] },
        },
      },
      caseId,
      conversationId,
      messageId,
      reason: { not: "" },
      scope: normalizedScope.value,
    },
  });
  if (!authorizedScope || authorizedScope.reason.trim().length < 12) {
    return { kind: "hidden", messages: [] };
  }

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
  if (
    authorizedScope.case.source === "MESSAGE_REPORT" &&
    (!authorizedScope.case.reporterId ||
      authorizedScope.case.targetType !== "MESSAGE" ||
      authorizedScope.case.targetId !== reportedMessage.id ||
      authorizedScope.case.reporterId === reportedMessage.senderId)
  ) {
    return { kind: "hidden", messages: [] };
  }
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
      body: message.deletedAt ? "" : message.body,
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
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
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
        isMessageReviewScope(scope.scope) &&
        scope.reason.trim().length >= 12,
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
