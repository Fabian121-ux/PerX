import type { CurrentUser } from "@/lib/auth/session";
import type { PublicTrustSummary } from "@/lib/trust/engine";

export interface DashboardConnection {
  id: string;
  name: string;
  username: string;
  headline: string;
  role: string;
  avatarUrl?: string;
  isOnline?: boolean;
}

export interface DashboardActivity {
  id: string;
  message: string;
  timeAgo: string;
  avatarUrl?: string;
  initials?: string;
}

export interface DashboardTrend {
  id: string;
  label: string;
  percentage: string;
  isUp: boolean;
  icon?: string;
}

export interface DashboardRecommendedProfile {
  id: string;
  name: string;
  username: string;
  headline: string;
  role: string;
  trust: PublicTrustSummary;
  avatarUrl?: string;
}

export interface DashboardOpportunity {
  id: string;
  slug: string;
  title: string;
  organisation: string;
  location: string;
  remote: boolean;
  budgetMinMinor: number;
  budgetMaxMinor: number;
  currency: string;
  type: string;
  postedTimeAgo: string;
  imageAlt?: string;
  imageUrl?: string;
}

export interface HomeDashboardData {
  user: CurrentUser;
  connections: DashboardConnection[];
  trust: PublicTrustSummary;
  activeDealsCount: number;
  activeDealsDetail?: string;
  connectionRequestsCount: number;
  draftsCount: number;
  notificationsCount: number;
  openProposalsCount: number;
  openProposalsDetail?: string;
  publishedItemsCount: number;
  unreadMessagesCount: number;
  onboarding: {
    dismissed: boolean;
    items: Array<{
      complete: boolean;
      href: string;
      label: string;
    }>;
  };
  recommendedProfiles: DashboardRecommendedProfile[];
  recommendedOpportunities: DashboardOpportunity[];
  activityFeed: DashboardActivity[];
  opportunityTrends: DashboardTrend[];
}
