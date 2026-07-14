import { getPerXDataProvider } from "./provider";

export async function getDashboardMetrics(userId: string) {
  const provider = await getPerXDataProvider();
  return provider.app.getDashboardMetrics(userId);
}

export async function getUserProposals(userId: string, direction: "sent" | "received") {
  const provider = await getPerXDataProvider();
  return provider.app.getUserProposals(userId, direction);
}

export async function getUserDeals(userId: string) {
  const provider = await getPerXDataProvider();
  return provider.app.getUserDeals(userId);
}

export async function getDealForUser(dealId: string, userId: string) {
  const provider = await getPerXDataProvider();
  return provider.app.getDealForUser(dealId, userId);
}

export async function getConversations(userId: string) {
  const provider = await getPerXDataProvider();
  return provider.app.getConversations(userId);
}

export async function getConversationMessages(conversationId: string) {
  const provider = await getPerXDataProvider();
  return provider.app.getConversationMessages(conversationId);
}
