import { getPrisma } from "@/lib/db/prisma";
import { PerXDataProvider } from "./interfaces";

type OpportunityTypeValue =
  | "JOB"
  | "FREELANCE_PROJECT"
  | "STARTUP"
  | "COFOUNDER"
  | "INVESTMENT"
  | "PROPERTY"
  | "SERVICE"
  | "PARTNERSHIP";

const opportunityTypes = new Set<OpportunityTypeValue>([
  "JOB",
  "FREELANCE_PROJECT",
  "STARTUP",
  "COFOUNDER",
  "INVESTMENT",
  "PROPERTY",
  "SERVICE",
  "PARTNERSHIP",
]);

function isOpportunityType(value?: string): value is OpportunityTypeValue {
  return Boolean(value && opportunityTypes.has(value as OpportunityTypeValue));
}

export const prismaProvider: PerXDataProvider = {
  opportunities: {
    getOpportunityFeed: async ({ category, q, type } = {}) => {
      return getPrisma().opportunity.findMany({
        include: {
          category: true,
          owner: { include: { profile: true } },
        },
        orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
        take: 20,
        where: {
          moderationStatus: "APPROVED",
          status: "PUBLISHED",
          ...(category ? { category: { slug: category } } : {}),
          ...(isOpportunityType(type) ? { type } : {}),
          ...(q
            ? {
                OR: [
                  { title: { contains: q, mode: "insensitive" } },
                  { summary: { contains: q, mode: "insensitive" } },
                  { description: { contains: q, mode: "insensitive" } },
                ],
              }
            : {}),
        },
      });
    },
    getOpportunityBySlug: async (slug: string) => {
      return getPrisma().opportunity.findFirst({
        include: {
          category: true,
          owner: { include: { profile: true, roles: { include: { role: true } } } },
        },
        where: {
          moderationStatus: "APPROVED",
          slug,
          status: "PUBLISHED",
        },
      });
    },
    getCategories: async () => {
      return getPrisma().opportunityCategory.findMany({ orderBy: { name: "asc" } });
    },
    getMyOpportunities: async (userId: string) => {
      return getPrisma().opportunity.findMany({
        include: { category: true },
        orderBy: { updatedAt: "desc" },
        where: { ownerId: userId },
      });
    },
  },
  app: {
    getDashboardMetrics: async (userId: string) => {
      const [opportunities, proposals, deals, notifications] = await Promise.all([
        getPrisma().opportunity.count({ where: { ownerId: userId } }),
        getPrisma().proposal.count({ where: { senderId: userId } }),
        getPrisma().dealParticipant.count({ where: { userId } }),
        getPrisma().notification.count({ where: { readAt: null, userId } }),
      ]);
      return { deals, notifications, opportunities, proposals };
    },
    getUserProposals: async (userId: string, direction: "sent" | "received") => {
      return getPrisma().proposal.findMany({
        include: { opportunity: true, sender: true },
        orderBy: { createdAt: "desc" },
        where: direction === "sent" ? { senderId: userId } : { opportunity: { ownerId: userId } },
      });
    },
    getUserDeals: async (userId: string) => {
      return getPrisma().deal.findMany({
        include: {
          participants: { include: { user: true } },
          proposal: { include: { opportunity: true } },
          statusHistory: { orderBy: { createdAt: "desc" }, take: 8 },
        },
        orderBy: { updatedAt: "desc" },
        where: { participants: { some: { userId } } },
      });
    },
    getDealForUser: async (dealId: string, userId: string) => {
      return getPrisma().deal.findFirst({
        include: {
          approvals: true,
          deliveries: true,
          ledgerEntries: true,
          milestones: true,
          participants: { include: { user: true } },
          proposal: { include: { opportunity: true } },
          releases: true,
          reviews: true,
          statusHistory: { orderBy: { createdAt: "asc" } },
        },
        where: { id: dealId, participants: { some: { userId } } },
      });
    },
    getConversations: async (userId: string) => {
      return getPrisma().conversation.findMany({
        include: {
          messages: { orderBy: { createdAt: "desc" }, take: 1 },
          opportunity: true,
          participants: { include: { user: true } },
        },
        orderBy: { updatedAt: "desc" },
        where: { participants: { some: { userId } } },
      });
    },
    getConversationMessages: async (conversationId: string) => {
      const messages = await getPrisma().message.findMany({
        where: { conversationId },
        orderBy: { createdAt: "desc" },
        take: 50,
        include: { sender: true },
      });
      return messages.reverse();
    },
  },
  profiles: {
    getPublicProfile: async (username: string) => {
      return getPrisma().user.findUnique({
        include: {
          profile: { include: { portfolio: true, skills: true, workHistory: true } },
          reviewsReceived: { take: 5, orderBy: { createdAt: "desc" } },
          roles: { include: { role: true } },
        },
        where: { username },
      });
    },
  },
  admin: {
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
    getAdminList: async (kind) => {
      switch (kind) {
        case "users":
          return getPrisma().user.findMany({ orderBy: { createdAt: "desc" }, take: 20 });
        case "profiles":
          return getPrisma().profile.findMany({ include: { user: true }, orderBy: { updatedAt: "desc" }, take: 20 });
        case "opportunities":
          return getPrisma().opportunity.findMany({ include: { owner: true }, orderBy: { updatedAt: "desc" }, take: 20 });
        case "reports":
          return getPrisma().opportunityReport.findMany({ include: { opportunity: true, reporter: true }, orderBy: { createdAt: "desc" }, take: 20 });
        case "reviews":
          return getPrisma().review.findMany({ include: { author: true, subject: true }, orderBy: { createdAt: "desc" }, take: 20 });
        case "disputes":
          return getPrisma().dispute.findMany({ include: { openedBy: true }, orderBy: { createdAt: "desc" }, take: 20 });
        case "verification":
          return getPrisma().verificationRequest.findMany({ include: { profile: { include: { user: true } } }, orderBy: { createdAt: "desc" }, take: 20 });
        case "audit":
          return getPrisma().auditLog.findMany({ include: { actor: true }, orderBy: { createdAt: "desc" }, take: 30 });
      }
    },
  },
};
