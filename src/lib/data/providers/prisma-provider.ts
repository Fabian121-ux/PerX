import { getPrisma } from "@/lib/db/prisma";
import {
  buildPublicOpportunityWhere,
  getPublicOpportunityPage,
} from "@/lib/data/public-opportunities";
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
      const page = await getPublicOpportunityPage({
        category,
        pageSize: 20,
        q,
        type: isOpportunityType(type) ? type : undefined,
      });

      return page.items;
    },
    getOpportunityBySlug: async (slug: string) => {
      return getPrisma().opportunity.findFirst({
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
        include: {
          opportunity: true,
          sender: true,
          versions: {
            include: { milestones: { orderBy: { position: "asc" } } },
            orderBy: { versionNumber: "desc" },
            where:
              direction === "received"
                ? { submittedAt: { not: null } }
                : undefined,
          },
        },
        orderBy: { createdAt: "desc" },
        where:
          direction === "sent"
            ? { senderId: userId }
            : {
                opportunity: { ownerId: userId },
                status: { not: "DRAFT" },
              },
      });
    },
    getUserDeals: async (userId: string) => {
      return getPrisma().deal.findMany({
        include: {
          participants: { include: { user: true } },
          proposal: { include: { opportunity: true } },
          proposalVersion: true,
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
          proposalVersion: true,
          releases: true,
          reviews: true,
          statusHistory: { orderBy: { createdAt: "asc" } },
        },
        where: { id: dealId, participants: { some: { userId } } },
      });
    },
    getConversations: async (userId: string) => {
      const blocks = await getPrisma().blockedUser.findMany({
        select: { blockedUserId: true, blockerUserId: true },
        where: {
          OR: [{ blockerUserId: userId }, { blockedUserId: userId }],
        },
      });
      const blockedUserIds = [
        ...new Set(
          blocks.map((block) =>
            block.blockerUserId === userId
              ? block.blockedUserId
              : block.blockerUserId,
          ),
        ),
      ];

      return getPrisma().conversation.findMany({
        include: {
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
            orderBy: { createdAt: "desc" },
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
                      profileImageUrl: true,
                      showLastActiveTime: true,
                      showPresence: true,
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
            orderBy: { createdAt: "desc" },
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
        orderBy: { updatedAt: "desc" },
        where: {
          status: "ACTIVE",
          participants: {
            every: blockedUserIds.length
              ? { userId: { notIn: blockedUserIds } }
              : {},
            some: { removedAt: null, userId },
          },
        },
      });
    },
    getConversationMessages: async (conversationId: string, userId: string) => {
      const messages = await getPrisma().message.findMany({
        where: {
          conversation: {
            participants: { some: { removedAt: null, userId } },
            status: "ACTIVE",
          },
          conversationId,
        },
        orderBy: { createdAt: "desc" },
        take: 50,
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
          sender: true,
        },
      });
      return messages.reverse();
    },
  },
  profiles: {
    getPublicProfile: async (username: string) => {
      return getPrisma().user.findFirst({
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
              portfolio: true,
              skills: { orderBy: { name: "asc" } },
              workHistory: true,
            },
          },
          reviewsReceived: {
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
          accountClassification: "PUBLIC_BETA_USER",
          isActive: true,
          profile: { is: { isDiscoverable: true } },
          username,
        },
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
