import { DiscoverExperience } from "@/components/discover/discover-experience";
import { PublicPageShell } from "@/components/standard-page";
import { demoProfiles } from "@/lib/data/demo";
import { getPublicDiscoveryData } from "@/lib/data/opportunities";

export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; q?: string; type?: string }>;
}) {
  const params = await searchParams;
  const { categories, opportunities, unavailable } = await getPublicDiscoveryData({
    category: params.category,
    q: params.q,
    type: params.type,
  });

  const profiles = demoProfiles.map((profile) => ({
    headline: profile.headline,
    name: profile.name,
    role: profile.roles.join(" / "),
    trustScore: profile.trustScore,
    username: profile.username,
  }));

  return (
    <PublicPageShell>
      <main className="mx-auto max-w-[1480px] px-4 py-8 sm:px-6 lg:px-8">
        <DiscoverExperience
          basePath="/discover"
          categories={categories}
          dataUnavailable={unavailable}
          mode="public"
          opportunities={opportunities}
          params={params}
          profiles={profiles}
        />
      </main>
    </PublicPageShell>
  );
}
