import { getPrisma } from "@/lib/db/prisma";
import { getUnreadCounts } from "@/lib/data/unread-counts";

export type ProfileActivity = {
  activeAgreements: number;
  completedAgreements: number;
  connections: number;
  conversations: number;
  drafts: number;
  proposalsReceived: number;
  proposalsSent: number;
  published: number;
  requestsReceived: number;
  requestsSent: number;
  savedItems: number;
  unreadConversations: number;
  degraded: boolean;
};

const EMPTY: ProfileActivity = {
  activeAgreements: 0,
  completedAgreements: 0,
  connections: 0,
  conversations: 0,
  degraded: false,
  drafts: 0,
  proposalsReceived: 0,
  proposalsSent: 0,
  published: 0,
  requestsReceived: 0,
  requestsSent: 0,
  savedItems: 0,
  unreadConversations: 0,
};

const ACTIVE_DEAL_STATUSES = ["AWAITING_FUNDING", "FUNDED", "IN_PROGRESS"] as const;
const COMPLETED_DEAL_STATUSES = ["APPROVED", "RELEASED"] as const;

/** Private counts for the signed-in member only. Each aggregate can fail independently. */
export async function getProfileActivity(userId: string): Promise<ProfileActivity> {
  if (!userId) return EMPTY;

  const prisma = getPrisma();
  const [results, unreadCounts] = await Promise.all([
    Promise.allSettled([
      prisma.dealParticipant.count({
        where: { deal: { status: { in: [...ACTIVE_DEAL_STATUSES] } }, userId },
      }),
      prisma.dealParticipant.count({
        where: { deal: { status: { in: [...COMPLETED_DEAL_STATUSES] } }, userId },
      }),
      prisma.proposal.count({ where: { senderId: userId } }),
      prisma.proposal.count({ where: { opportunity: { ownerId: userId } } }),
      prisma.opportunity.count({ where: { ownerId: userId, status: "DRAFT" } }),
      prisma.opportunity.count({ where: { ownerId: userId, status: "PUBLISHED" } }),
      prisma.opportunityBookmark.count({ where: { userId } }),
      prisma.connection.count({
        where: { status: "ACCEPTED", OR: [{ requesterId: userId }, { receiverId: userId }] },
      }),
      prisma.connection.count({ where: { requesterId: userId, status: "PENDING" } }),
      prisma.connection.count({ where: { receiverId: userId, status: "PENDING" } }),
      prisma.conversationParticipant.count({
        where: { userId, removedAt: null, conversation: { status: "ACTIVE" } },
      }),
    ]),
    getUnreadCounts(userId),
  ]);

  const values = results.map((result) =>
    result.status === "fulfilled" ? result.value : 0,
  );
  const [
    activeAgreements,
    completedAgreements,
    proposalsSent,
    proposalsReceived,
    drafts,
    published,
    savedItems,
    connections,
    requestsSent,
    requestsReceived,
    conversations,
  ] = values;

  return {
    activeAgreements,
    completedAgreements,
    connections,
    conversations,
    degraded: results.some((result) => result.status === "rejected"),
    drafts,
    proposalsReceived,
    proposalsSent,
    published,
    requestsReceived,
    requestsSent,
    savedItems,
    unreadConversations: unreadCounts.unreadConversations,
  };
}
