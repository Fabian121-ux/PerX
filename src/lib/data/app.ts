import { getPerXDataProvider } from "./provider";
import type { CursorPageParams } from "@/lib/data/cursor";

export async function getDashboardMetrics(userId: string) {
  const provider = await getPerXDataProvider();
  return provider.app.getDashboardMetrics(userId);
}

export async function getUserProposals(
  userId: string,
  direction: "sent" | "received",
) {
  const provider = await getPerXDataProvider();
  return provider.app.getUserProposals(userId, direction);
}

export async function getUserProposalsPage(
  userId: string,
  direction: "sent" | "received",
  params?: CursorPageParams,
) {
  const provider = await getPerXDataProvider();
  return provider.app.getUserProposalsPage(userId, direction, params);
}

export async function getUserDeals(userId: string) {
  const provider = await getPerXDataProvider();
  return provider.app.getUserDeals(userId);
}

export async function getUserDealsPage(
  userId: string,
  params?: CursorPageParams,
) {
  const provider = await getPerXDataProvider();
  return provider.app.getUserDealsPage(userId, params);
}

export async function getDealForUser(dealId: string, userId: string) {
  const provider = await getPerXDataProvider();
  return provider.app.getDealForUser(dealId, userId);
}

export async function getConversations(userId: string) {
  const provider = await getPerXDataProvider();
  return provider.app.getConversations(userId);
}

export async function getConversationsPage(
  userId: string,
  params?: CursorPageParams,
) {
  const provider = await getPerXDataProvider();
  return provider.app.getConversationsPage(userId, params);
}

export async function getConversationForUser(
  conversationId: string,
  userId: string,
) {
  const provider = await getPerXDataProvider();
  return provider.app.getConversationForUser(conversationId, userId);
}

export async function getConversationMessages(
  conversationId: string,
  userId: string,
) {
  const provider = await getPerXDataProvider();
  return provider.app.getConversationMessages(conversationId, userId);
}

export async function getConversationMessagesPage(
  conversationId: string,
  userId: string,
  params?: CursorPageParams,
) {
  const provider = await getPerXDataProvider();
  return provider.app.getConversationMessagesPage(
    conversationId,
    userId,
    params,
  );
}
