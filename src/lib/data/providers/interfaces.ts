/* eslint-disable @typescript-eslint/no-explicit-any */
import type { CursorPage, CursorPageParams } from "@/lib/data/cursor";

export type AdminListKind =
  | "users"
  | "profiles"
  | "opportunities"
  | "reports"
  | "reviews"
  | "disputes"
  | "verification"
  | "audit";

export interface PerXOpportunityProvider {
  getOpportunityFeed(filters?: { category?: string; q?: string; type?: string }): Promise<any[]>;
  getOpportunityBySlug(slug: string): Promise<any>;
  getCategories(): Promise<any[]>;
  getMyOpportunities(userId: string): Promise<any[]>;
  getMyOpportunitiesPage(userId: string, params?: CursorPageParams): Promise<CursorPage<any>>;
}

export interface PerXAppProvider {
  getDashboardMetrics(userId: string): Promise<any>;
  getUserProposals(userId: string, direction: "sent" | "received"): Promise<any[]>;
  getUserProposalsPage(
    userId: string,
    direction: "sent" | "received",
    params?: CursorPageParams,
  ): Promise<CursorPage<any>>;
  getUserDeals(userId: string): Promise<any[]>;
  getUserDealsPage(userId: string, params?: CursorPageParams): Promise<CursorPage<any>>;
  getDealForUser(dealId: string, userId: string): Promise<any>;
  getConversations(userId: string): Promise<any[]>;
  getConversationsPage(userId: string, params?: CursorPageParams): Promise<CursorPage<any>>;
  getConversationForUser(conversationId: string, userId: string): Promise<any | null>;
  getConversationMessages(conversationId: string, userId: string): Promise<any[]>;
  getConversationMessagesPage(
    conversationId: string,
    userId: string,
    params?: CursorPageParams,
  ): Promise<CursorPage<any>>;
}

export interface PerXProfileProvider {
  getPublicProfile(username: string): Promise<any>;
}

export interface PerXAdminProvider {
  getAdminMetrics(): Promise<any>;
  getAdminList(kind: AdminListKind): Promise<any[]>;
  getAdminListPage(kind: AdminListKind, params?: CursorPageParams): Promise<CursorPage<any>>;
}

export interface PerXDataProvider {
  opportunities: PerXOpportunityProvider;
  app: PerXAppProvider;
  profiles: PerXProfileProvider;
  admin: PerXAdminProvider;
}
