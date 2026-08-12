/* eslint-disable @typescript-eslint/no-explicit-any */
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getDashboardMetrics } from "@/lib/data/app";
import { getAuthenticatedHomeOpportunityPageResult } from "@/lib/data/opportunities";
import { getTemporaryOpportunityImage } from "@/lib/data/temporary-images";
import { HomeDashboard } from "@/components/dashboard/home-dashboard";
import type { HomeDashboardData } from "@/components/dashboard/types";
import { calculateTrustSummary } from "@/lib/trust/engine";
import { getPrisma } from "@/lib/db/prisma";
import { getUnreadCounts } from "@/lib/data/unread-counts";
import { hasCapability } from "@/lib/permissions/capabilities";
import { getTrustRecordEvidence } from "@/lib/trust/records";

export const dynamic = "force-dynamic";

function getTimeAgo(dateString: string | Date | undefined) {
  if (!dateString) return "recently";
  const date = new Date(dateString);
  const diffInMs = new Date().getTime() - date.getTime();
  const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
  if (diffInHours < 24) return `${diffInHours || 1}h ago`;
  const diffInDays = Math.floor(diffInHours / 24);
  return `${diffInDays}d ago`;
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string; limit?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/sign-in");
  }

  const params = await searchParams;
  const requestedPageSize = params.limit ? Number(params.limit) : undefined;
  const metrics = await getDashboardMetrics(user.id);
  const [
    opportunityPage,
    unreadCounts,
    activeOutgoingConnectionCount,
    draftsCount,
    publishedItemsCount,
  ] = await Promise.all([
    getAuthenticatedHomeOpportunityPageResult({
      cursor: params.cursor,
      pageSize: requestedPageSize,
      viewerId: user.id,
    }),
    getUnreadCounts(user.id),
    getPrisma().connection.count({
      where: {
        requesterId: user.id,
        status: { in: ["PENDING", "ACCEPTED"] },
      },
    }),
    getPrisma().opportunity.count({
      where: { ownerId: user.id, status: "DRAFT" },
    }),
    getPrisma().opportunity.count({
      where: { ownerId: user.id, status: "PUBLISHED" },
    }),
  ]);
  const [savedBookmarks, currentUserTrustEvidence] = await Promise.all([
    getPrisma().opportunityBookmark.findMany({
      select: { opportunityId: true },
      where: {
        opportunityId: { in: opportunityPage.items.map((item: any) => item.id) },
        userId: user.id,
      },
    }),
    getTrustRecordEvidence(user.id),
  ]);
  const savedOpportunityIds = new Set(
    savedBookmarks.map((bookmark) => bookmark.opportunityId),
  );
  const canCreate = hasCapability(user.roles, "opportunity:create");

  const dashboardData: HomeDashboardData = {
    user,
    connections: [],
    trust: calculateTrustSummary({
      averageRating: currentUserTrustEvidence.averageRating,
      completedDeals: currentUserTrustEvidence.completedAgreements,
      emailVerifiedAt: user.emailVerifiedAt ?? null,
      profileCompleteness: user.profile?.profileCompleteness ?? 0,
      verificationStatus: user.verificationStatus,
    }),
    activeDealsCount: metrics.deals,
    activeDealsDetail: "Active workflows",
    connectionRequestsCount: unreadCounts.pendingConnectionRequests,
    draftsCount,
    activityCount: unreadCounts.generalActivity,
    openProposalsCount: metrics.proposals,
    openProposalsDetail: "Sent or countered",
    publishedItemsCount,
    unreadConversationsCount: unreadCounts.unreadConversations,
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
          complete: activeOutgoingConnectionCount > 0,
          href: "/app/people",
          label: "Find people",
        },
        ...(canCreate
          ? [
              {
                complete: publishedItemsCount > 0,
                href: "/app/opportunities/new",
                label: "Publish your first item",
              },
            ]
          : []),
        {
          complete: activeOutgoingConnectionCount > 0,
          href: "/app/people",
          label: "Send a connection request",
        },
      ],
    },
    recommendedProfiles: [],
    recommendedOpportunities: opportunityPage.items.map((opp: any) => {
      const fallbackImage = getTemporaryOpportunityImage(opp.slug);
      const storedImage = opp.images?.find((image: any) => image.isCover) ??
        opp.images?.[0];
      const recordEvidence = opp.owner.trustRecordEvidence;
      return {
        authorAvatarUrl:
          opp.owner?.profile?.profileImageUrl ?? opp.owner?.imageUrl ?? undefined,
        authorUsername: opp.owner?.username ?? undefined,
        id: opp.id,
        slug: opp.slug,
        title: opp.title,
        organisation: opp.owner?.name ?? "Independent",
        location: opp.location ?? "Location not specified",
        remote: opp.remote,
        budgetMinMinor: opp.budgetMinMinor?.toString() ?? null,
        budgetMaxMinor: opp.budgetMaxMinor?.toString() ?? null,
        currency: opp.currency,
        type: opp.type,
        postedTimeAgo: getTimeAgo(opp.publishedAt || undefined),
        imageAlt:
          storedImage?.altText ??
          fallbackImage.alt ??
          `${opp.title} opportunity preview`,
        imageUrl: storedImage?.url ?? fallbackImage.src,
        summary: opp.summary,
        trust: calculateTrustSummary({
          averageRating: recordEvidence?.averageRating ?? 0,
          completedDeals: recordEvidence?.completedAgreements ?? 0,
          emailVerifiedAt: opp.owner?.emailVerifiedAt ?? null,
          profileCompleteness: opp.owner?.profile?.profileCompleteness ?? 0,
          verificationStatus: opp.owner?.verificationStatus,
        }),
        viewerHasSaved: savedOpportunityIds.has(opp.id),
      };
    }),
    activityFeed: [],
    opportunityTrends: [],
  };

  const nextHref = opportunityPage.nextCursor
    ? `/app?${new URLSearchParams({
        cursor: opportunityPage.nextCursor,
        limit: String(opportunityPage.pageSize),
      }).toString()}`
    : null;

  return (
    <HomeDashboard
      data={dashboardData}
      opportunityFeed={{
        firstPageHref: opportunityPage.cursor ? "/app" : null,
        nextHref,
        unavailable: opportunityPage.unavailable,
      }}
    />
  );
}
