import { getPrisma } from "@/lib/db/prisma";
import { hasDatabaseUrl } from "@/lib/env";
import { isLocalTestUser } from "@/lib/dev/test-auth";
import { getTestConversations, getTestDealForUser, getTestDashboardMetrics, getTestUserDeals, getTestUserProposals } from "@/lib/data/test-data-adapter";
import { getCurrentUser } from "@/lib/auth/session";

export async function getDashboardMetrics(userId: string) {
  const user = await getCurrentUser();
  if (isLocalTestUser(user)) return getTestDashboardMetrics();

  if (!hasDatabaseUrl()) {
    return {
      deals: 0,
      notifications: 0,
      opportunities: 0,
      proposals: 0,
    };
  }

  const [opportunities, proposals, deals, notifications] = await Promise.all([
    getPrisma().opportunity.count({ where: { ownerId: userId } }),
    getPrisma().proposal.count({ where: { senderId: userId } }),
    getPrisma().dealParticipant.count({ where: { userId } }),
    getPrisma().notification.count({ where: { readAt: null, userId } }),
  ]);

  return { deals, notifications, opportunities, proposals };
}

export async function getUserProposals(userId: string, direction: "sent" | "received") {
  const user = await getCurrentUser();
  if (isLocalTestUser(user)) return getTestUserProposals() as never;

  if (!hasDatabaseUrl()) return [];

  return getPrisma().proposal.findMany({
    include: { opportunity: true, sender: true },
    orderBy: { createdAt: "desc" },
    where: direction === "sent" ? { senderId: userId } : { opportunity: { ownerId: userId } },
  });
}

export async function getUserDeals(userId: string) {
  const user = await getCurrentUser();
  if (isLocalTestUser(user)) return getTestUserDeals() as never;

  if (!hasDatabaseUrl()) return [];

  return getPrisma().deal.findMany({
    include: {
      participants: { include: { user: true } },
      proposal: { include: { opportunity: true } },
      statusHistory: { orderBy: { createdAt: "desc" }, take: 8 },
    },
    orderBy: { updatedAt: "desc" },
    where: { participants: { some: { userId } } },
  });
}

export async function getDealForUser(dealId: string, userId: string) {
  const user = await getCurrentUser();
  if (isLocalTestUser(user)) return getTestDealForUser(dealId) as never;

  if (!hasDatabaseUrl()) return null;

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
}

export async function getConversations(userId: string) {
  const user = await getCurrentUser();
  if (isLocalTestUser(user)) return getTestConversations() as never;

  if (!hasDatabaseUrl()) return [];

  return getPrisma().conversation.findMany({
    include: {
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
      opportunity: true,
      participants: { include: { user: true } },
    },
    orderBy: { updatedAt: "desc" },
    where: { participants: { some: { userId } } },
  });
}
