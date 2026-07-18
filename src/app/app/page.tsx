/* eslint-disable @typescript-eslint/no-explicit-any */
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getDashboardMetrics } from "@/lib/data/app";
import { getOpportunityFeed } from "@/lib/data/opportunities";
import { getTemporaryOpportunityImage } from "@/lib/data/temporary-images";
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
    connections: [],
    trustScore: user.profile?.trustScore ?? 0,
    activeDealsCount: metrics.deals,
    activeDealsDetail: "In progress",
    openProposalsCount: metrics.proposals,
    openProposalsDetail: "Awaiting response",
    recommendedProfiles: [],
    recommendedOpportunities: topOpps.map((opp: any) => {
      const image = getTemporaryOpportunityImage(opp.slug);
      return {
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
        imageAlt: image.alt,
        imageUrl: image.src,
      };
    }),
    activityFeed: [],
    opportunityTrends: [],
  };

  return <HomeDashboard data={mockDashboardData} />;
}
