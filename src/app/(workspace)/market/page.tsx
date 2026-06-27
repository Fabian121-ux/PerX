import { redirect } from "next/navigation";

import { DiscoverExperience } from "@/components/discover/discover-experience";
import { getCurrentUser } from "@/lib/auth/session";
import { demoProfiles } from "@/lib/data/demo";
import { getCategories, getOpportunityFeed } from "@/lib/data/opportunities";

export default async function MarketPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; q?: string; type?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const params = await searchParams;
  const [opportunities, categories] = await Promise.all([
    getOpportunityFeed({
      category: params.category,
      q: params.q,
      type: params.type,
    }),
    getCategories(),
  ]);

  const profiles = demoProfiles.map((profile) => ({
    headline: profile.headline,
    name: profile.name,
    role: profile.roles.join(" · "),
    trustScore: profile.trustScore,
    username: profile.username,
  }));

  return (
    <DiscoverExperience
      basePath="/market"
      categories={categories}
      mode="app"
      opportunities={opportunities}
      params={params}
      profiles={profiles}
    />
  );
}
