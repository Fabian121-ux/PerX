import type { CurrentUser } from "@/lib/auth/session";

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
  trustScore: number;
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
  imageUrl?: string;
}

export interface HomeDashboardData {
  user: CurrentUser;
  connections: DashboardConnection[];
  trustScore: number | null;
  activeDealsCount: number;
  activeDealsDetail?: string;
  openProposalsCount: number;
  openProposalsDetail?: string;
  recommendedProfiles: DashboardRecommendedProfile[];
  recommendedOpportunities: DashboardOpportunity[];
  activityFeed: DashboardActivity[];
  opportunityTrends: DashboardTrend[];
}
