import { previewOpportunities } from "@/lib/data/preview";
import { RecommendedOpportunities } from "@/components/dashboard/recommended-opportunities";
import { RecommendedProfiles } from "@/components/dashboard/recommended-profiles";

export default function PreviewDiscoverPage() {
  const recommendedProfiles = [
    { id: "maya-client", name: "Maya Chen", username: "maya-client", role: "Startup Founder", headline: "Building cross-border services", trustScore: 86 },
    { id: "david-okafor", name: "David Okafor", username: "david-okafor", role: "Full-stack Developer", headline: "Scaling marketplace MVPs", trustScore: 92 },
    { id: "amara-nwosu", name: "Amara Nwosu", username: "amara-nwosu", role: "Brand Strategist", headline: "Positioning health startups", trustScore: 78 },
    { id: "tunde-bello", name: "Tunde Bello", username: "tunde-bello", role: "Startup Advisor", headline: "Connecting capital and talent", trustScore: 95 },
  ];

  const opportunities = previewOpportunities.map(opp => ({
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
  }));

  return (
    <div className="flex w-full flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-black text-[color:var(--px-text)] sm:text-3xl">Discover</h1>
        <p className="text-sm text-[color:var(--px-text-muted)]">Find your next opportunity or collaborator.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="flex flex-col gap-8">
          <RecommendedOpportunities opportunities={opportunities} />
        </div>
        
        <div className="flex flex-col gap-6">
          <RecommendedProfiles profiles={recommendedProfiles} />
        </div>
      </div>
    </div>
  );
}
