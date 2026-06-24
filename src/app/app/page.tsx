import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getDashboardMetrics } from "@/lib/data/app";
import { getOpportunityFeed } from "@/lib/data/opportunities";
import { HomeDashboard } from "@/components/dashboard/home-dashboard";
import type { HomeDashboardData } from "@/components/dashboard/types";

function getTimeAgo(dateString: string | Date | undefined) {
  if (!dateString) return "recently";
  const date = new Date(dateString);
  const diffInMs = new Date().getTime() - date.getTime();
  const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
  if (diffInHours < 24) return `${diffInHours || 1}h ago`;
  const diffInDays = Math.floor(diffInHours / 24);
  return `${diffInDays}d ago`;
}

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/sign-in");
  }

  const metrics = await getDashboardMetrics(user.id);
  const recentOpps = await getOpportunityFeed();

  // Pick top 5 opportunities for recommended
  const topOpps = recentOpps.slice(0, 5);

  const mockDashboardData: HomeDashboardData = {
    user,
    connections: [
      { id: "maya-client", name: "Maya Chen", username: "maya-client", role: "Product Founder", headline: "Building cross-border services", isOnline: true },
      { id: "david-okafor", name: "David Okafor", username: "david-okafor", role: "Full-stack Developer", headline: "Scaling marketplace MVPs", isOnline: false },
      { id: "amara-nwosu", name: "Amara Nwosu", username: "amara-nwosu", role: "Brand Strategist", headline: "Positioning health startups", isOnline: true },
      { id: "tunde-bello", name: "Tunde Bello", username: "tunde-bello", role: "Startup Advisor", headline: "Connecting capital and talent", isOnline: false },
    ],
    trustScore: user.profile?.trustScore ?? 0,
    activeDealsCount: metrics.deals,
    activeDealsDetail: "In progress",
    openProposalsCount: metrics.proposals,
    openProposalsDetail: "Awaiting response",
    recommendedProfiles: [
      { id: "maya-client", name: "Maya Chen", username: "maya-client", role: "Startup Founder", headline: "Building cross-border services", trustScore: 86 },
      { id: "david-okafor", name: "David Okafor", username: "david-okafor", role: "Full-stack Developer", headline: "Scaling marketplace MVPs", trustScore: 92 },
      { id: "amara-nwosu", name: "Amara Nwosu", username: "amara-nwosu", role: "Brand Strategist", headline: "Positioning health startups", trustScore: 78 },
      { id: "tunde-bello", name: "Tunde Bello", username: "tunde-bello", role: "Startup Advisor", headline: "Connecting capital and talent", trustScore: 95 },
      { id: "sofia-martins", name: "Sofia Martins", username: "sofia-martins", role: "Product Designer", headline: "Designing trust-led platforms", trustScore: 88 },
    ],
    recommendedOpportunities: topOpps.map(opp => ({
      id: opp.id,
      slug: opp.slug,
      title: opp.title,
      organisation: opp.owner?.name ?? "Independent",
      location: opp.location ?? "Remote",
      remote: opp.remote,
      budgetMinMinor: Number(opp.budgetMinMinor ?? 0),
      budgetMaxMinor: Number(opp.budgetMaxMinor ?? 0),
      currency: opp.currency,
      type: opp.type,
      postedTimeAgo: getTimeAgo(opp.publishedAt || undefined),
      imageUrl: undefined, // Add realistic image resolving logic if needed
    })),
    activityFeed: [
      { id: "act-1", message: "Maya Chen sent you a proposal for Product Discovery Sprint.", timeAgo: "1h ago", initials: "MC" },
      { id: "act-2", message: "David Okafor submitted milestone 2 for Marketplace MVP.", timeAgo: "3h ago", initials: "DO" },
      { id: "act-3", message: "A saved opportunity is closing soon.", timeAgo: "5h ago", initials: "PX" },
    ],
    opportunityTrends: [
      { id: "tr-1", label: "Product design projects", percentage: "18.5%", isUp: true },
      { id: "tr-2", label: "Software opportunities", percentage: "24.2%", isUp: true },
      { id: "tr-3", label: "Founder collaborations", percentage: "12.0%", isUp: true },
      { id: "tr-4", label: "Marketing roles", percentage: "4.1%", isUp: false },
    ],
  };

  return <HomeDashboard data={mockDashboardData} />;
}
