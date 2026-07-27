import { DiscoverExperience } from "@/components/discover/discover-experience";
import { PublicPageShell } from "@/components/standard-page";
import { getPublicDiscoveryData } from "@/lib/data/opportunities";
import { getPublicPeopleDirectory } from "@/lib/data/people";

export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<{
    category?: string;
    q?: string;
    sort?: string;
    type?: string;
  }>;
}) {
  const params = await searchParams;
  const opportunityType = getOpportunityFilterType(params.type);
  const [{ categories, opportunities, unavailable }, peopleResult] =
    await Promise.all([
      getPublicDiscoveryData({
      category: params.category,
      q: params.q,
      type: opportunityType,
      }),
      getPublicPeopleDirectory({ q: params.q }, { limit: 12 }).catch(() => ({
        nextCursor: null,
        people: [],
      })),
    ]);

  const profiles = peopleResult.people.map((person) => ({
    headline: person.headline,
    imageUrl: person.imageUrl,
    name: person.name,
    role: person.roles[0] ?? "PerX member",
    trust: person.trust,
    username: person.username,
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

function getOpportunityFilterType(type?: string) {
  return [
    "JOB",
    "FREELANCE_PROJECT",
    "STARTUP",
    "COFOUNDER",
    "PARTNERSHIP",
    "SERVICE",
  ].includes(type ?? "")
    ? type
    : undefined;
}
