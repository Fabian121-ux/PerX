/* eslint-disable @typescript-eslint/no-explicit-any */
export interface PerXOpportunityProvider {
  getOpportunityFeed(filters?: { category?: string; q?: string; type?: string }): Promise<any[]>;
  getOpportunityBySlug(slug: string): Promise<any>;
  getCategories(): Promise<any[]>;
  getMyOpportunities(userId: string): Promise<any[]>;
}

export interface PerXAppProvider {
  getDashboardMetrics(userId: string): Promise<any>;
  getUserProposals(userId: string, direction: "sent" | "received"): Promise<any[]>;
  getUserDeals(userId: string): Promise<any[]>;
  getDealForUser(dealId: string, userId: string): Promise<any>;
  getConversations(userId: string): Promise<any[]>;
  getConversationMessages(conversationId: string): Promise<any[]>;
}

export interface PerXProfileProvider {
  getPublicProfile(username: string): Promise<any>;
}

export interface PerXAdminProvider {
  getAdminMetrics(): Promise<any>;
  getAdminList(kind: "users" | "profiles" | "opportunities" | "reports" | "reviews" | "disputes" | "verification" | "audit"): Promise<any[]>;
}

export interface PerXDataProvider {
  opportunities: PerXOpportunityProvider;
  app: PerXAppProvider;
  profiles: PerXProfileProvider;
  admin: PerXAdminProvider;
}
