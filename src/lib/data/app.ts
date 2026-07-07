import { getPerXDataProvider } from "./provider";
import { isLocalTestUser } from "@/lib/dev/test-auth";
import { getTestConversations, getTestDealForUser, getTestDashboardMetrics, getTestUserDeals, getTestUserProposals } from "@/lib/data/test-data-adapter";
import { getCurrentUser } from "@/lib/auth/session";

export async function getDashboardMetrics(userId: string) {
  const user = await getCurrentUser();
  if (isLocalTestUser(user)) return getTestDashboardMetrics();

  const provider = await getPerXDataProvider();
  return provider.app.getDashboardMetrics(userId);
}

export async function getUserProposals(userId: string, direction: "sent" | "received") {
  const user = await getCurrentUser();
  if (isLocalTestUser(user)) return getTestUserProposals() as never;

  const provider = await getPerXDataProvider();
  return provider.app.getUserProposals(userId, direction);
}

export async function getUserDeals(userId: string) {
  const user = await getCurrentUser();
  if (isLocalTestUser(user)) return getTestUserDeals() as never;

  const provider = await getPerXDataProvider();
  return provider.app.getUserDeals(userId);
}

export async function getDealForUser(dealId: string, userId: string) {
  const user = await getCurrentUser();
  if (isLocalTestUser(user)) return getTestDealForUser(dealId) as never;

  const provider = await getPerXDataProvider();
  return provider.app.getDealForUser(dealId, userId);
}

export async function getConversations(userId: string) {
  const user = await getCurrentUser();
  if (isLocalTestUser(user)) return getTestConversations() as never;

  const provider = await getPerXDataProvider();
  return provider.app.getConversations(userId);
}
