import { HomeDashboard } from "@/components/dashboard/home-dashboard";
import type { HomeDashboardData } from "@/components/dashboard/types";
import { 
  previewUser, 
  previewOpportunities, 
  previewDeals, 
  previewProposals
} from "@/lib/data/preview";
import { getTemporaryOpportunityImage } from "@/lib/data/temporary-images";

export default function PreviewDashboardPage() {
  const mockDashboardData: HomeDashboardData = {
    user: {
      id: previewUser.id,
      email: previewUser.email,
      name: previewUser.name,
      username: previewUser.username,
      roles: previewUser.roles as never[],
    },
    connections: [
      { id: "maya-client", name: "Maya Chen", username: "maya-client", role: "Product Founder", headline: "Building cross-border services", isOnline: true },
      { id: "david-okafor", name: "David Okafor", username: "david-okafor", role: "Full-stack Developer", headline: "Scaling marketplace MVPs", isOnline: false },
      { id: "amara-nwosu", name: "Amara Nwosu", username: "amara-nwosu", role: "Brand Strategist", headline: "Positioning health startups", isOnline: true },
      { id: "tunde-bello", name: "Tunde Bello", username: "tunde-bello", role: "Startup Advisor", headline: "Connecting capital and talent", isOnline: false },
    ],
    trustScore: previewUser.trustScore,
    activeDealsCount: previewDeals.filter(d => ["FUNDED", "IN_PROGRESS", "SUBMITTED", "UNDER_REVIEW"].includes(d.status)).length || 3,
    activeDealsDetail: "2 milestones in progress",
    openProposalsCount: previewProposals.filter(p => p.status === "SENT").length || 7,
    openProposalsDetail: "3 awaiting response",
    recommendedProfiles: [
      { id: "maya-client", name: "Maya Chen", username: "maya-client", role: "Startup Founder", headline: "Building cross-border services", trustScore: 86 },
      { id: "david-okafor", name: "David Okafor", username: "david-okafor", role: "Full-stack Developer", headline: "Scaling marketplace MVPs", trustScore: 92 },
      { id: "amara-nwosu", name: "Amara Nwosu", username: "amara-nwosu", role: "Brand Strategist", headline: "Positioning health startups", trustScore: 78 },
      { id: "tunde-bello", name: "Tunde Bello", username: "tunde-bello", role: "Startup Advisor", headline: "Connecting capital and talent", trustScore: 95 },
      { id: "sofia-martins", name: "Sofia Martins", username: "sofia-martins", role: "Product Designer", headline: "Designing trust-led platforms", trustScore: 88 },
    ],
    recommendedOpportunities: previewOpportunities.map((opp) => {
      const image = getTemporaryOpportunityImage(opp.slug);
      return {
        id: opp.id,
        slug: opp.slug,
        title: opp.title,
        organisation: opp.owner.name,
        location: opp.location,
        remote: opp.remote,
        budgetMinMinor: opp.budgetMinMinor,
        budgetMaxMinor: opp.budgetMaxMinor,
        currency: opp.currency,
        type: opp.type,
        postedTimeAgo: "2h ago",
        imageAlt: image.alt,
        imageUrl: image.src,
      };
    }),
    activityFeed: [
      { id: "act-1", message: "Maya Chen sent you a proposal for Product Discovery Sprint.", timeAgo: "1h ago", initials: "MC" },
      { id: "act-2", message: "David Okafor submitted milestone 2 for Marketplace MVP.", timeAgo: "3h ago", initials: "DO" },
      { id: "act-3", message: "A saved opportunity is closing soon.", timeAgo: "5h ago", initials: "pX" },
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
