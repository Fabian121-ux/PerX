/* eslint-disable @typescript-eslint/no-explicit-any */
import { PerXDataProvider } from "./interfaces";
import { 
  previewOpportunities, 
  previewDeals, 
  previewProposals, 
  previewConversations,
  previewUser,
  previewReviews
} from "../preview";
import { demoCategories, demoOpportunities, demoProfiles } from "../demo";
import {
  createCursorPage,
  MAX_CURSOR_PAGE_SIZE,
  normalizeCursorPageParams,
  type CursorPage,
  type CursorPageParams,
} from "@/lib/data/cursor";
import type { AdminListKind } from "./interfaces";

// Process-local, non-persistent store for mock writes
let opportunitiesStore = [...previewOpportunities];
let dealsStore = [...previewDeals];
let proposalsStore = [...previewProposals];
let conversationsStore = [...previewConversations];

function mockTimestamp(value: any) {
  const candidate =
    value.updatedAt ??
    value.createdAt ??
    value.publishedAt ??
    value.messages?.at(-1)?.createdAt ??
    value.statusHistory?.at(-1)?.createdAt ??
    "1970-01-01T00:00:00.000Z";
  const date = new Date(candidate);
  return Number.isNaN(date.getTime()) ? new Date(0) : date;
}

function paginateMockRows<T extends { id: string }>(
  rows: T[],
  params: CursorPageParams | undefined,
  options: { chronological?: boolean; scope?: string } = {},
) {
  const { cursor, pageSize, requestedCursor } = normalizeCursorPageParams(
    params,
    options.scope,
  );
  const sorted = [...rows].sort((left, right) => {
    const timeDifference = mockTimestamp(right).getTime() - mockTimestamp(left).getTime();
    return timeDifference || right.id.localeCompare(left.id);
  });
  const filtered = cursor
    ? sorted.filter((row) => {
        const timestamp = mockTimestamp(row).getTime();
        return (
          timestamp < cursor.timestamp.getTime() ||
          (timestamp === cursor.timestamp.getTime() && row.id < cursor.id)
        );
      })
    : sorted;
  const hasNextPage = filtered.length > pageSize;
  const pageRows = hasNextPage ? filtered.slice(0, pageSize) : filtered;
  const items = options.chronological ? [...pageRows].reverse() : pageRows;

  return createCursorPage(items, {
    cursor: requestedCursor,
    getTimestamp: mockTimestamp,
    hasNextPage,
    nextCursorItem: options.chronological ? items[0] : items.at(-1),
    pageSize,
    scope: options.scope,
  });
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

function getMockUserProposals(userId: string, direction: "sent" | "received") {
  return proposalsStore
    .filter((p: any) => {
      if (direction === "sent") {
        return p.sender.username === userId || p.senderId === userId;
      }
      const opportunity = opportunitiesStore.find(
        (candidate) => candidate.id === p.opportunityId,
      );
      return (
        p.status !== "DRAFT" &&
        (opportunity?.owner.username === userId ||
          p.opportunity?.owner?.username === userId)
      );
    })
    .map((proposal: any) => ({
      ...proposal,
      versions: proposal.versions ?? [
        {
          amountMinor: proposal.amountMinor,
          currency: proposal.currency,
          deliveryDays: proposal.deliveryDays,
          description: proposal.description,
          id: `${proposal.id}-version-1`,
          includedRevisions: proposal.revisions,
          milestones: proposal.milestones ?? [],
          status: proposal.status === "SENT" ? "SUBMITTED" : proposal.status,
          versionNumber: 1,
        },
      ],
    }));
}

function getMockAdminRows(kind: AdminListKind): any[] {
  switch (kind) {
    case "users":
      return [
        {
          accountClassification: "PUBLIC_BETA_USER",
          createdAt: null,
          email: previewUser.email,
          id: previewUser.id,
          isActive: true,
          name: previewUser.name,
          roles: previewUser.roles.map((name) => ({ role: { label: name, name } })),
          username: previewUser.username,
          verificationStatus: "VERIFIED",
        },
      ];
    case "profiles":
      return demoProfiles.map((profile) => ({
        ...profile,
        id: `demo-profile-${profile.username}`,
        updatedAt: new Date(0),
      }));
    case "opportunities":
      return opportunitiesStore;
    case "reports":
      return [];
    case "reviews":
      return previewReviews;
    case "disputes":
      return [];
    case "verification":
      return [];
    case "audit":
      return [];
  }
}

export const mockProvider: PerXDataProvider = {
  opportunities: {
    getOpportunityFeed: async ({ category, q, type } = {}) => {
      // In mock mode, we try to use previewOpportunities or demoOpportunities
      let base = [...opportunitiesStore];
      if (base.length === 0) {
        // Fallback to demoOpportunities structure if preview ones are somehow empty
        base = demoOpportunities as any;
      }
      
      return base.filter((opp: any) => {
        const matchesCategory = !category || opp.category.slug === category;
        const matchesType = !type || opp.type === type;
        const matchesQuery = !q || `${opp.title} ${opp.summary}`.toLowerCase().includes(q.toLowerCase());
        return matchesCategory && matchesType && matchesQuery;
      });
    },
    getOpportunityBySlug: async (slug: string) => {
      return opportunitiesStore.find((opp) => opp.slug === slug) || 
             demoOpportunities.find((opp) => opp.slug === slug) || null;
    },
    getCategories: async () => {
      return demoCategories;
    },
    getMyOpportunities: (userId: string) =>
      collectCursorPages((params) =>
        mockProvider.opportunities.getMyOpportunitiesPage(userId, params),
      ),
    getMyOpportunitiesPage: async (userId: string, params?: CursorPageParams) =>
      paginateMockRows(
        opportunitiesStore.filter(
          (opp: any) => opp.owner.username === userId || opp.ownerId === userId,
        ),
        params,
        { scope: `opportunities:${userId}` },
      ),
  },
  app: {
    getDashboardMetrics: async () => {
      return {
        deals: dealsStore.length,
        notifications: 3,
        opportunities: opportunitiesStore.length,
        proposals: proposalsStore.length,
      };
    },
    getUserProposals: (userId: string, direction: "sent" | "received") =>
      collectCursorPages((params) =>
        mockProvider.app.getUserProposalsPage(userId, direction, params),
      ),
    getUserProposalsPage: async (
      userId: string,
      direction: "sent" | "received",
      params?: CursorPageParams,
    ) =>
      paginateMockRows(getMockUserProposals(userId, direction), params, {
        scope: `proposals:${userId}:${direction}`,
      }),
    getUserDeals: (userId: string) =>
      collectCursorPages((params) =>
        mockProvider.app.getUserDealsPage(userId, params),
      ),
    getUserDealsPage: async (userId: string, params?: CursorPageParams) =>
      paginateMockRows(
        dealsStore.filter((d: any) =>
          d.participants?.some(
            (p: any) => p.username === userId || p.id === userId,
          ),
        ),
        params,
        { scope: `deals:${userId}` },
      ),
    getDealForUser: async (dealId: string, userId: string) => {
      return dealsStore.find((d: any) => 
        d.id === dealId && d.participants?.some((p: any) => p.username === userId || p.id === userId)
      ) || null;
    },
    getConversations: (userId: string) =>
      collectCursorPages((params) =>
        mockProvider.app.getConversationsPage(userId, params),
      ),
    getConversationsPage: async (
      userId: string,
      params?: CursorPageParams,
    ) =>
      paginateMockRows(
        conversationsStore.filter((conversation) =>
          isMockConversationVisibleToUser(conversation, userId),
        ),
        params,
        { scope: `conversations:${userId}` },
      ),
    getConversationForUser: async (conversationId: string, userId: string) =>
      conversationsStore.find(
        (candidate) =>
          candidate.id === conversationId &&
          isMockConversationVisibleToUser(candidate, userId),
      ) ?? null,
    getConversationMessages: async (conversationId: string, userId: string) =>
      (
        await mockProvider.app.getConversationMessagesPage(
          conversationId,
          userId,
          { pageSize: MAX_CURSOR_PAGE_SIZE },
        )
      ).items,
    getConversationMessagesPage: async (
      conversationId: string,
      userId: string,
      params?: CursorPageParams,
    ) => {
      const conv = conversationsStore.find(
        (candidate) =>
          candidate.id === conversationId &&
          isMockConversationVisibleToUser(candidate, userId),
      );
      return paginateMockRows(conv?.messages ?? [], params, {
        chronological: true,
        scope: `messages:${userId}:${conversationId}`,
      });
    },
  },
  profiles: {
    getPublicProfile: async (username: string) => {
      if (username === previewUser.username) {
        return {
          ...previewUser,
          profile: {
            skills: previewUser.skills.map((s, i) => ({ id: String(i), name: s })),
          },
          roles: previewUser.roles.map((r) => ({ role: { name: r } })),
          reviewsReceived: previewReviews,
        };
      }
      return demoProfiles.find((p) => p.username === username) || null;
    },
  },
  admin: {
    getAdminMetrics: async () => {
      return { auditLogs: 42, disputes: 1, opportunities: opportunitiesStore.length, reports: 0, reviews: previewReviews.length, users: 5, verification: 2 };
    },
    getAdminList: async (kind) =>
      (
        await mockProvider.admin.getAdminListPage(kind, {
          pageSize: kind === "audit" ? 30 : 20,
        })
      ).items,
    getAdminListPage: async (kind: AdminListKind, params?: CursorPageParams) =>
      paginateMockRows(getMockAdminRows(kind), params, {
        scope: `admin:${kind}`,
      }),
  },
};

function isMockConversationVisibleToUser(
  conversation: (typeof conversationsStore)[number],
  userId: string,
) {
  return userId === previewUser.id || conversation.participantUsername === userId;
}

export function resetMockStore() {
  opportunitiesStore = [...previewOpportunities];
  dealsStore = [...previewDeals];
  proposalsStore = [...previewProposals];
  conversationsStore = [...previewConversations];
}
