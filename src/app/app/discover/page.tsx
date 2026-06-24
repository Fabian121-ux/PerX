import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";

// Re-use the existing discover page component or a subset of it, but inside the app shell.
// For now, since the actual Discover component might be highly complex, we will render a placeholder or the same components if possible.
// Wait, the user said "They may initially reuse suitable discovery components and data... If another destination is not implemented, open the shared Feature Status dialog instead of routing to a public page or 404."
// Actually, it's safer to just build a simple Discover wrapper here using the recommended-opportunities.tsx and recommended-profiles.tsx, or just a mock layout. Let me check what the public /discover does. Let me just create a basic page.
import { getOpportunityFeed } from "@/lib/data/opportunities";
import { RecommendedOpportunities } from "@/components/dashboard/recommended-opportunities";
import { RecommendedProfiles } from "@/components/dashboard/recommended-profiles";

export default async function AppDiscoverPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const feed = await getOpportunityFeed();
  
  // Create mock profiles for now to populate the discover page
  const mockProfiles = [
    { id: "p1", name: "Maya Chen", username: "maya-chen", role: "UX Engineer", headline: "Building intuitive interfaces", trustScore: 92 },
    { id: "p2", name: "David Okafor", username: "david-o", role: "Backend Developer", headline: "Scaling systems and APIs", trustScore: 88 },
    { id: "p3", name: "Amara Nwosu", username: "amara-n", role: "Product Manager", headline: "Driving product strategy", trustScore: 85 },
    { id: "p4", name: "Tunde Bello", username: "tunde-b", role: "Data Scientist", headline: "Extracting value from data", trustScore: 78 },
  ];

  return (
    <div className="flex w-full flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-black text-[color:var(--px-text)] sm:text-3xl">Discover</h1>
        <p className="text-sm text-[color:var(--px-text-muted)]">Find your next opportunity or collaborator.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="flex flex-col gap-8">
          <RecommendedOpportunities opportunities={feed.slice(0, 10).map(o => ({
            id: o.id,
            title: o.title,
            organisation: "Startup Inc",
            location: "Remote",
            remote: o.remote,
            type: o.type,
            budgetMinMinor: Number(o.budgetMinMinor ?? 0),
            budgetMaxMinor: Number(o.budgetMaxMinor ?? 0),
            currency: o.currency,
            postedTimeAgo: "2h ago",
            slug: o.slug,
          }))} />
        </div>
        
        <div className="flex flex-col gap-6">
          <RecommendedProfiles profiles={mockProfiles} />
        </div>
      </div>
    </div>
  );
}
