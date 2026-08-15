/* eslint-disable @typescript-eslint/no-explicit-any */
import type { CursorPage, CursorPageParams } from "@/lib/data/cursor";
import type {
  AccountClassification,
  DealSettlementMode,
  DealStatus,
  RoleName,
  VerificationStatus,
} from "@/generated/prisma/enums";

export type AdminListKind =
  | "users"
  | "profiles"
  | "opportunities"
  | "reports"
  | "reviews"
  | "disputes"
  | "deals"
  | "verification"
  | "audit";

export type AdminAccountState =
  | "ACTIVE"
  | "BANNED"
  | "DEACTIVATED"
  | "INACTIVE"
  | "SUSPENDED";

export type AdminUserSummary = {
  accountClassification: AccountClassification;
  accountState: AdminAccountState;
  activeRestrictions: Array<{
    kind: "CONNECTION_REQUESTS" | "MESSAGING" | "PUBLISHING";
    until: Date;
  }>;
  activity: {
    completedAgreements: number;
    ownedOpportunities: number;
    publicReviewsReceived: number;
  };
  createdAt: Date;
  email: string;
  id: string;
  name: string;
  roles: Array<{ label: string; name: RoleName }>;
  suspendedUntil: Date | null;
  username: string;
  verificationStatus: VerificationStatus;
};

export type AdminDealSummary = {
  currency: string;
  id: string;
  milestoneCount: number;
  participantCount: number;
  participantPreview: Array<{
    role: string;
    user: { name: string; username: string };
  }>;
  settlementMode: DealSettlementMode;
  status: DealStatus;
  title: string;
  unresolvedDisputeCount: number;
  updatedAt: Date;
  valueMinor: bigint;
};

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
  getAdminDealsPage(params?: CursorPageParams): Promise<CursorPage<AdminDealSummary>>;
  getAdminMetrics(): Promise<any>;
  getAdminList(kind: AdminListKind): Promise<any[]>;
  getAdminListPage(kind: AdminListKind, params?: CursorPageParams): Promise<CursorPage<any>>;
  getAdminUsersPage(params?: CursorPageParams): Promise<CursorPage<AdminUserSummary>>;
}

export interface PerXDataProvider {
  opportunities: PerXOpportunityProvider;
  app: PerXAppProvider;
  profiles: PerXProfileProvider;
  admin: PerXAdminProvider;
}
