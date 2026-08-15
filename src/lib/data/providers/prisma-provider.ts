import { getPrisma } from "@/lib/db/prisma";
import {
  buildPublicOpportunityWhere,
  getPublicOpportunityPage,
} from "@/lib/data/public-opportunities";
import { getEligibleNetworkUserWhere } from "@/features/network/eligibility";
import { getTrustRecordEvidence } from "@/lib/trust/records";
import {
  createCursorPage,
  MAX_CURSOR_PAGE_SIZE,
  normalizeCursorPageParams,
  withCursor,
  type CursorPage,
  type CursorPageParams,
} from "@/lib/data/cursor";
import { buildConversationAccessWhere } from "@/lib/messages/access";
import {
  getAdminAccountState,
  getAdminActiveRestrictions,
} from "@/lib/admin/operational-summaries";
import type { Prisma } from "@/generated/prisma/client";
import type {
  AdminDealSummary,
  AdminListKind,
  AdminUserSummary,
  PerXDataProvider,
} from "./interfaces";

type OpportunityTypeValue =
  | "JOB"
  | "FREELANCE_PROJECT"
  | "STARTUP"
  | "COFOUNDER"
  | "INVESTMENT"
  | "PRODUCT"
  | "PROPERTY"
  | "SERVICE"
  | "PARTNERSHIP";

const opportunityTypes = new Set<OpportunityTypeValue>([
  "JOB",
  "FREELANCE_PROJECT",
  "STARTUP",
  "COFOUNDER",
  "INVESTMENT",
  "PRODUCT",
  "PROPERTY",
  "SERVICE",
  "PARTNERSHIP",
]);

function isOpportunityType(value?: string): value is OpportunityTypeValue {
  return Boolean(value && opportunityTypes.has(value as OpportunityTypeValue));
}

async function getMyOpportunitiesPage(
  userId: string,
  params?: CursorPageParams,
) {
  const scope = `opportunities:${userId}`;
  const { cursor, pageSize, requestedCursor } = normalizeCursorPageParams(
    params,
    scope,
  );
  const rows = await getPrisma().opportunity.findMany({
    include: { category: true },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take: pageSize + 1,
    where: withCursor<Prisma.OpportunityWhereInput>(
      { ownerId: userId },
      cursor,
      { direction: "desc", field: "updatedAt" },
    ),
  });
  const hasNextPage = rows.length > pageSize;
  const items = hasNextPage ? rows.slice(0, pageSize) : rows;

  return createCursorPage(items, {
    cursor: requestedCursor,
    getTimestamp: (item) => item.updatedAt,
    hasNextPage,
    pageSize,
    scope,
  });
}

async function getUserProposalsPage(
  userId: string,
  direction: "sent" | "received",
  params?: CursorPageParams,
) {
  const scope = `proposals:${userId}:${direction}`;
  const { cursor, pageSize, requestedCursor } = normalizeCursorPageParams(
    params,
    scope,
  );
  const where: Prisma.ProposalWhereInput =
    direction === "sent"
      ? { senderId: userId }
      : {
          opportunity: { ownerId: userId },
          status: { not: "DRAFT" },
        };
  const rows = await getPrisma().proposal.findMany({
    include: {
      opportunity: true,
      sender: { select: { id: true, name: true, username: true } },
      versions: {
        include: { milestones: { orderBy: { position: "asc" } } },
        orderBy: { versionNumber: "desc" },
        where:
          direction === "received"
            ? { submittedAt: { not: null } }
            : undefined,
      },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: pageSize + 1,
    where: withCursor<Prisma.ProposalWhereInput>(
      where,
      cursor,
      { direction: "desc", field: "createdAt" },
    ),
  });
  const hasNextPage = rows.length > pageSize;
  const items = hasNextPage ? rows.slice(0, pageSize) : rows;

  return createCursorPage(items, {
    cursor: requestedCursor,
    getTimestamp: (item) => item.createdAt,
    hasNextPage,
    pageSize,
    scope,
  });
}

async function getUserDealsPage(userId: string, params?: CursorPageParams) {
  const scope = `deals:${userId}`;
  const { cursor, pageSize, requestedCursor } = normalizeCursorPageParams(
    params,
    scope,
  );
  const rows = await getPrisma().deal.findMany({
    include: {
      participants: {
        include: {
          user: {
            select: { id: true, imageUrl: true, name: true, username: true },
          },
        },
      },
      proposal: { include: { opportunity: true } },
      proposalVersion: true,
      statusHistory: { orderBy: { createdAt: "desc" }, take: 8 },
    },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take: pageSize + 1,
    where: withCursor<Prisma.DealWhereInput>(
      { participants: { some: { userId } } },
      cursor,
      { direction: "desc", field: "updatedAt" },
    ),
  });
  const hasNextPage = rows.length > pageSize;
  const items = hasNextPage ? rows.slice(0, pageSize) : rows;

  return createCursorPage(items, {
    cursor: requestedCursor,
    getTimestamp: (item) => item.updatedAt,
    hasNextPage,
    pageSize,
    scope,
  });
}

async function getConversationsPage(
  userId: string,
  params?: CursorPageParams,
  conversationId?: string,
) {
  const scope = `conversations:${userId}`;
  const { cursor, pageSize, requestedCursor } = normalizeCursorPageParams(
    params,
    scope,
  );
  const where: Prisma.ConversationWhereInput = {
    ...buildConversationAccessWhere(userId),
    ...(conversationId ? { id: conversationId } : {}),
  };
  const rows = await getPrisma().conversation.findMany({
    include: {
      _count: {
        select: {
          proposals: {
            where: { status: { in: ["DRAFT", "SENT", "COUNTERED", "ACCEPTED"] } },
          },
        },
      },
      events: {
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 50,
      },
      messages: {
        include: {
          readReceipts: { select: { userId: true } },
          replyTo: {
            select: {
              body: true,
              deletedAt: true,
              id: true,
              sender: { select: { id: true, name: true, username: true } },
              senderId: true,
            },
          },
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 1,
      },
      opportunity: true,
      participants: {
        include: {
          user: {
            select: {
              id: true,
              imageUrl: true,
              name: true,
              profile: {
                select: {
                  biography: true,
                  headline: true,
                  location: true,
                  profileImageUrl: true,
                  showLastActiveTime: true,
                  showLocation: true,
                  showPresence: true,
                  showSkills: true,
                  skills: {
                    orderBy: { name: "asc" },
                    select: { name: true },
                    take: 12,
                  },
                },
              },
              sessions: {
                orderBy: { lastSeenAt: "desc" },
                select: { lastSeenAt: true },
                take: 1,
              },
              username: true,
            },
          },
        },
      },
      proposals: {
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: {
          deal: {
            select: {
              currency: true,
              id: true,
              proposalVersion: { select: { versionNumber: true } },
              settlementMode: true,
              status: true,
              valueMinor: true,
            },
          },
        },
        take: 1,
        where: { deal: { isNot: null } },
      },
    },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take: pageSize + 1,
    where: withCursor<Prisma.ConversationWhereInput>(
      where,
      cursor,
      { direction: "desc", field: "updatedAt" },
    ),
  });
  const hasNextPage = rows.length > pageSize;
  const items = hasNextPage ? rows.slice(0, pageSize) : rows;

  return createCursorPage(items, {
    cursor: requestedCursor,
    getTimestamp: (item) => item.updatedAt,
    hasNextPage,
    pageSize,
    scope,
  });
}

async function getConversationForUser(conversationId: string, userId: string) {
  const page = await getConversationsPage(
    userId,
    { pageSize: 1 },
    conversationId,
  );
  return page.items[0] ?? null;
}

async function getConversationMessagesPage(
  conversationId: string,
  userId: string,
  params?: CursorPageParams,
) {
  const scope = `messages:${userId}:${conversationId}`;
  const { cursor, pageSize, requestedCursor } = normalizeCursorPageParams(
    params,
    scope,
  );
  const where: Prisma.MessageWhereInput = {
    conversation: buildConversationAccessWhere(userId),
    conversationId,
  };
  const rows = await getPrisma().message.findMany({
    where: withCursor<Prisma.MessageWhereInput>(
      where,
      cursor,
      { direction: "desc", field: "createdAt" },
    ),
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: pageSize + 1,
    include: {
      readReceipts: { select: { userId: true } },
      replyTo: {
        select: {
          body: true,
          deletedAt: true,
          id: true,
          sender: { select: { id: true, name: true, username: true } },
          senderId: true,
        },
      },
      sender: {
        select: { id: true, imageUrl: true, name: true, username: true },
      },
    },
  });
  const hasNextPage = rows.length > pageSize;
  const pageRows = hasNextPage ? rows.slice(0, pageSize) : rows;
  const items = pageRows.reverse();

  return createCursorPage(items, {
    cursor: requestedCursor,
    getTimestamp: (item) => item.createdAt,
    hasNextPage,
    nextCursorItem: items[0],
    pageSize,
    scope,
  });
}

async function getAdminUsersPage(
  params?: CursorPageParams,
): Promise<CursorPage<AdminUserSummary>> {
  const scope = "admin:users";
  const { cursor, pageSize, requestedCursor } = normalizeCursorPageParams(
    params,
    scope,
  );
  const rows = await getPrisma().user.findMany({
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: {
      _count: {
        select: {
          deals: {
            where: { deal: { status: { in: ["APPROVED", "RELEASED"] } } },
          },
          opportunities: true,
          reviewsReceived: { where: { visibility: "PUBLIC" } },
        },
      },
      accountClassification: true,
      bannedAt: true,
      connectionRequestsRestrictedUntil: true,
      createdAt: true,
      deactivatedAt: true,
      email: true,
      id: true,
      isActive: true,
      messagingRestrictedUntil: true,
      name: true,
      publishingRestrictedUntil: true,
      roles: {
        select: { role: { select: { label: true, name: true } } },
      },
      suspendedAt: true,
      suspendedUntil: true,
      username: true,
      verificationStatus: true,
    },
    take: pageSize + 1,
    where: withCursor<Prisma.UserWhereInput>(
      {},
      cursor,
      { direction: "desc", field: "createdAt" },
    ),
  });
  const hasNextPage = rows.length > pageSize;
  const pageRows = hasNextPage ? rows.slice(0, pageSize) : rows;
  const items: AdminUserSummary[] = pageRows.map((row) => ({
    accountClassification: row.accountClassification,
    accountState: getAdminAccountState(row),
    activeRestrictions: getAdminActiveRestrictions(row),
    activity: {
      completedAgreements: row._count.deals,
      ownedOpportunities: row._count.opportunities,
      publicReviewsReceived: row._count.reviewsReceived,
    },
    createdAt: row.createdAt,
    email: row.email,
    id: row.id,
    name: row.name,
    roles: row.roles.map(({ role }) => role),
    suspendedUntil: row.suspendedUntil,
    username: row.username,
    verificationStatus: row.verificationStatus,
  }));
  return createCursorPage(items, {
    cursor: requestedCursor,
    getTimestamp: (item) => item.createdAt,
    hasNextPage,
    nextCursorItem: items.at(-1),
    pageSize,
    scope,
  });
}

async function getAdminDealsPage(
  params?: CursorPageParams,
): Promise<CursorPage<AdminDealSummary>> {
  const scope = "admin:deals";
  const { cursor, pageSize, requestedCursor } = normalizeCursorPageParams(
    params,
    scope,
  );
  const rows = await getPrisma().deal.findMany({
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    select: {
      _count: {
        select: {
          disputes: { where: { status: { not: "RESOLVED" } } },
          milestones: true,
          participants: true,
        },
      },
      currency: true,
      id: true,
      participants: {
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: {
          role: true,
          user: { select: { name: true, username: true } },
        },
        take: 6,
      },
      proposal: { select: { opportunity: { select: { title: true } } } },
      settlementMode: true,
      status: true,
      updatedAt: true,
      valueMinor: true,
    },
    take: pageSize + 1,
    where: withCursor<Prisma.DealWhereInput>(
      {},
      cursor,
      { direction: "desc", field: "updatedAt" },
    ),
  });
  const hasNextPage = rows.length > pageSize;
  const pageRows = hasNextPage ? rows.slice(0, pageSize) : rows;
  const items: AdminDealSummary[] = pageRows.map((row) => ({
    currency: row.currency,
    id: row.id,
    milestoneCount: row._count.milestones,
    participantCount: row._count.participants,
    participantPreview: row.participants,
    settlementMode: row.settlementMode,
    status: row.status,
    title: row.proposal.opportunity.title,
    unresolvedDisputeCount: row._count.disputes,
    updatedAt: row.updatedAt,
    valueMinor: row.valueMinor,
  }));
  return createCursorPage(items, {
    cursor: requestedCursor,
    getTimestamp: (item) => item.updatedAt,
    hasNextPage,
    nextCursorItem: items.at(-1),
    pageSize,
    scope,
  });
}

async function getAdminListPage(kind: AdminListKind, params?: CursorPageParams) {
  if (kind === "users") return getAdminUsersPage(params);
  if (kind === "deals") return getAdminDealsPage(params);
  const scope = `admin:${kind}`;
  const { cursor, pageSize, requestedCursor } = normalizeCursorPageParams(
    params,
    scope,
  );
  const page = (rows: Array<{ id: string; createdAt?: Date | null; updatedAt?: Date | null }>, field: "createdAt" | "updatedAt") => {
    const hasNextPage = rows.length > pageSize;
    const items = hasNextPage ? rows.slice(0, pageSize) : rows;
    return createCursorPage(items, {
      cursor: requestedCursor,
      getTimestamp: (item) => item[field] ?? new Date(0),
      hasNextPage,
      pageSize,
      scope,
    });
  };

  switch (kind) {
    case "profiles": {
      const rows = await getPrisma().profile.findMany({
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        select: {
          headline: true,
          id: true,
          profileCompleteness: true,
          trustScore: true,
          updatedAt: true,
          user: { select: { id: true, name: true, username: true } },
        },
        take: pageSize + 1,
        where: withCursor<Prisma.ProfileWhereInput>(
          {},
          cursor,
          { direction: "desc", field: "updatedAt" },
        ),
      });
      return page(rows, "updatedAt");
    }
    case "opportunities": {
      const rows = await getPrisma().opportunity.findMany({
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        select: {
          id: true,
          moderationStatus: true,
          owner: { select: { id: true, name: true, username: true } },
          status: true,
          title: true,
          type: true,
          updatedAt: true,
        },
        take: pageSize + 1,
        where: withCursor<Prisma.OpportunityWhereInput>(
          {},
          cursor,
          { direction: "desc", field: "updatedAt" },
        ),
      });
      return page(rows, "updatedAt");
    }
    case "reports": {
      const rows = await getPrisma().opportunityReport.findMany({
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: {
          createdAt: true,
          id: true,
          opportunity: { select: { id: true, slug: true, title: true } },
          reason: true,
          reporter: { select: { id: true, name: true, username: true } },
          status: true,
        },
        take: pageSize + 1,
        where: withCursor<Prisma.OpportunityReportWhereInput>(
          {},
          cursor,
          { direction: "desc", field: "createdAt" },
        ),
      });
      return page(rows, "createdAt");
    }
    case "reviews": {
      const rows = await getPrisma().review.findMany({
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: {
          author: { select: { id: true, name: true, username: true } },
          body: true,
          createdAt: true,
          dealId: true,
          id: true,
          rating: true,
          subject: { select: { id: true, name: true, username: true } },
          title: true,
          visibility: true,
        },
        take: pageSize + 1,
        where: withCursor<Prisma.ReviewWhereInput>(
          {},
          cursor,
          { direction: "desc", field: "createdAt" },
        ),
      });
      return page(rows, "createdAt");
    }
    case "disputes": {
      const rows = await getPrisma().dispute.findMany({
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: {
          createdAt: true,
          id: true,
          openedBy: { select: { id: true, name: true, username: true } },
          reason: true,
          resolution: true,
          status: true,
          updatedAt: true,
        },
        take: pageSize + 1,
        where: withCursor<Prisma.DisputeWhereInput>(
          {},
          cursor,
          { direction: "desc", field: "createdAt" },
        ),
      });
      return page(rows, "createdAt");
    }
    case "verification": {
      const rows = await getPrisma().verificationRequest.findMany({
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: {
          createdAt: true,
          id: true,
          notes: true,
          profile: {
            select: {
              headline: true,
              id: true,
              user: { select: { id: true, name: true, username: true } },
            },
          },
          status: true,
          updatedAt: true,
        },
        take: pageSize + 1,
        where: withCursor<Prisma.VerificationRequestWhereInput>(
          {},
          cursor,
          { direction: "desc", field: "createdAt" },
        ),
      });
      return page(rows, "createdAt");
    }
    case "audit": {
      const rows = await getPrisma().auditLog.findMany({
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: {
          action: true,
          actor: { select: { id: true, name: true, username: true } },
          createdAt: true,
          entityId: true,
          entityType: true,
          id: true,
          metadata: true,
        },
        take: pageSize + 1,
        where: withCursor<Prisma.AuditLogWhereInput>(
          {},
          cursor,
          { direction: "desc", field: "createdAt" },
        ),
      });
      return page(rows, "createdAt");
    }
  }
}

async function collectCursorPages<T>(
  load: (params?: CursorPageParams) => Promise<CursorPage<T>>,
) {
  const items: T[] = [];
  const seenCursors = new Set<string>();
  let cursor: string | undefined;

  while (true) {
    const page = await load({
      ...(cursor ? { cursor } : {}),
      pageSize: MAX_CURSOR_PAGE_SIZE,
    });
    items.push(...page.items);
    if (!page.nextCursor || seenCursors.has(page.nextCursor)) return items;
    seenCursors.add(page.nextCursor);
    cursor = page.nextCursor;
  }
}

export const prismaProvider: PerXDataProvider = {
  opportunities: {
    getOpportunityFeed: async ({ category, q, type } = {}) => {
      const page = await getPublicOpportunityPage({
        category,
        pageSize: 20,
        q,
        type: isOpportunityType(type) ? type : undefined,
      });

      return page.items;
    },
    getOpportunityBySlug: async (slug: string) => {
      const opportunity = await getPrisma().opportunity.findFirst({
        include: {
          category: true,
          images: {
            orderBy: [{ isCover: "desc" }, { createdAt: "asc" }],
            take: 4,
          },
          owner: {
            select: {
              id: true,
              emailVerifiedAt: true,
              imageUrl: true,
              name: true,
              profile: {
                select: {
                  averageRating: true,
                  completedDeals: true,
                  profileCompleteness: true,
                  profileImageUrl: true,
                },
              },
              roles: { include: { role: true } },
              username: true,
              verificationStatus: true,
            },
          },
        },
        where: { ...buildPublicOpportunityWhere(), slug },
      });
      if (!opportunity) return null;

      return {
        ...opportunity,
        owner: {
          ...opportunity.owner,
          trustRecordEvidence: await getTrustRecordEvidence(
            opportunity.owner.id,
          ),
        },
      };
    },
    getCategories: async () => {
      return getPrisma().opportunityCategory.findMany({ orderBy: { name: "asc" } });
    },
    getMyOpportunities: (userId: string) =>
      collectCursorPages((params) => getMyOpportunitiesPage(userId, params)),
    getMyOpportunitiesPage,
  },
  app: {
    getDashboardMetrics: async (userId: string) => {
      const [opportunities, proposals, deals, notifications] = await Promise.all([
        getPrisma().opportunity.count({ where: { ownerId: userId } }),
        getPrisma().proposal.count({
          where: { senderId: userId, status: { in: ["SENT", "COUNTERED"] } },
        }),
        getPrisma().dealParticipant.count({
          where: {
            deal: {
              status: {
                in: [
                  "AWAITING_FUNDING",
                  "FUNDED",
                  "IN_PROGRESS",
                  "SUBMITTED",
                  "UNDER_REVIEW",
                ],
              },
            },
            userId,
          },
        }),
        getPrisma().notification.count({ where: { readAt: null, userId } }),
      ]);
      return { deals, notifications, opportunities, proposals };
    },
    getUserProposals: (userId: string, direction: "sent" | "received") =>
      collectCursorPages((params) =>
        getUserProposalsPage(userId, direction, params),
      ),
    getUserProposalsPage,
    getUserDeals: (userId: string) =>
      collectCursorPages((params) => getUserDealsPage(userId, params)),
    getUserDealsPage,
    getDealForUser: async (dealId: string, userId: string) => {
      return getPrisma().deal.findFirst({
        include: {
          approvals: true,
          deliveries: true,
          ledgerEntries: true,
          milestones: true,
          participants: { include: { user: true } },
          proposal: { include: { opportunity: true } },
          proposalVersion: true,
          releases: true,
          reviews: true,
          statusHistory: { orderBy: { createdAt: "asc" } },
        },
        where: { id: dealId, participants: { some: { userId } } },
      });
    },
    getConversations: (userId: string) =>
      collectCursorPages((params) => getConversationsPage(userId, params)),
    getConversationsPage,
    getConversationForUser,
    getConversationMessages: async (conversationId: string, userId: string) =>
      (
        await getConversationMessagesPage(conversationId, userId, {
          pageSize: MAX_CURSOR_PAGE_SIZE,
        })
      ).items,
    getConversationMessagesPage,
  },
  profiles: {
    getPublicProfile: async (username: string) => {
      const profile = await getPrisma().user.findFirst({
        select: {
          createdAt: true,
          emailVerifiedAt: true,
          id: true,
          imageUrl: true,
          name: true,
          opportunities: {
            include: {
              category: true,
              images: {
                orderBy: [{ isCover: "desc" }, { createdAt: "asc" }],
                take: 4,
              },
            },
            orderBy: { publishedAt: "desc" },
            take: 8,
            where: buildPublicOpportunityWhere(),
          },
          profile: {
            include: {
              portfolio: { orderBy: [{ createdAt: "desc" }, { id: "desc" }] },
              skills: { orderBy: { name: "asc" } },
              workHistory: {
                orderBy: [{ startedAt: "desc" }, { id: "desc" }],
              },
            },
          },
          reviewsReceived: {
            include: {
              author: { select: { name: true, username: true } },
            },
            orderBy: { createdAt: "desc" },
            take: 5,
            where: { visibility: "PUBLIC" },
          },
          roles: {
            select: {
              role: { select: { label: true, name: true } },
            },
          },
          username: true,
          verificationStatus: true,
        },
        where: {
          ...getEligibleNetworkUserWhere(),
          profile: { is: { isDiscoverable: true } },
          username,
        },
      });
      if (!profile) return null;
      return {
        ...profile,
        trustRecordEvidence: await getTrustRecordEvidence(profile.id),
      };
    },
  },
  admin: {
    getAdminDealsPage,
    getAdminMetrics: async () => {
      const [users, opportunities, reports, reviews, disputes, verification, auditLogs] = await Promise.all([
        getPrisma().user.count(),
        getPrisma().opportunity.count(),
        getPrisma().opportunityReport.count({ where: { status: "OPEN" } }),
        getPrisma().review.count(),
        getPrisma().dispute.count(),
        getPrisma().verificationRequest.count({ where: { status: "PENDING" } }),
        getPrisma().auditLog.count(),
      ]);
      return { auditLogs, disputes, opportunities, reports, reviews, users, verification };
    },
    getAdminList: async (kind) =>
      (
        await getAdminListPage(kind, {
          pageSize: kind === "audit" ? 30 : 20,
        })
      ).items,
    getAdminListPage,
    getAdminUsersPage,
  },
};
