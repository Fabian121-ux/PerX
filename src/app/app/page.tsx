/* eslint-disable @typescript-eslint/no-explicit-any */
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getDashboardMetrics } from "@/lib/data/app";
import { getOpportunityFeed } from "@/lib/data/opportunities";
import { getTemporaryOpportunityImage } from "@/lib/data/temporary-images";
import { HomeDashboard } from "@/components/dashboard/home-dashboard";
import type { HomeDashboardData } from "@/components/dashboard/types";
import { calculateTrustSummary } from "@/lib/trust/engine";
import { getPrisma } from "@/lib/db/prisma";
import { getUnreadCounts } from "@/lib/data/unread-counts";

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
  const [
    recentOpps,
    unreadCounts,
    connectionActivityCount,
    connectionRequestsCount,
    draftsCount,
    publishedItemsCount,
  ] = await Promise.all([
    getOpportunityFeed(),
    getUnreadCounts(user.id),
    getPrisma().connection.count({
      where: {
        OR: [{ requesterId: user.id }, { receiverId: user.id }],
      },
    }),
    getPrisma().connection.count({
      where: { receiverId: user.id, status: "PENDING" },
    }),
    getPrisma().opportunity.count({
      where: { ownerId: user.id, status: "DRAFT" },
    }),
    getPrisma().opportunity.count({
      where: { ownerId: user.id, status: "PUBLISHED" },
    }),
  ]);

  // Pick top 5 opportunities for recommended
  const topOpps = recentOpps.slice(0, 5);

  const dashboardData: HomeDashboardData = {
    user,
    connections: [],
    trust: calculateTrustSummary({
      emailVerifiedAt: user.emailVerifiedAt ?? null,
      profileCompleteness: user.profile?.profileCompleteness ?? 0,
      verificationStatus: user.verificationStatus,
    }),
    activeDealsCount: metrics.deals,
    activeDealsDetail: "In progress",
    connectionRequestsCount,
    draftsCount,
    notificationsCount: unreadCounts.notifications,
    openProposalsCount: metrics.proposals,
    openProposalsDetail: "Awaiting response",
    publishedItemsCount,
    unreadMessagesCount: unreadCounts.messages,
    onboarding: {
      dismissed: Boolean(user.onboardingDismissedAt),
      items: [
        {
          complete: (user.profile?.profileCompleteness ?? 0) >= 70,
          href: "/app/profile/edit",
          label: "Complete your profile",
        },
        {
          complete: Boolean(user.imageUrl || user.profile?.profileImageUrl),
          href: "/app/profile/edit",
          label: "Add a profile image",
        },
        {
          complete: Boolean(user.profile?.skills?.length),
          href: "/app/profile/edit",
          label: "Select skills or interests",
        },
        {
          complete: connectionActivityCount > 0,
          href: "/app/people",
          label: "Find people",
        },
        {
          complete: publishedItemsCount > 0,
          href: "/app/opportunities/new",
          label: "Publish your first item",
        },
        {
          complete: connectionActivityCount > 0,
          href: "/app/people",
          label: "Send a connection request",
        },
      ],
    },
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

  return <HomeDashboard data={dashboardData} />;
}
