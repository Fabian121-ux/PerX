import { redirect } from "next/navigation";

import { DiscoverExperience } from "@/components/discover/discover-experience";
import { getCurrentUser } from "@/lib/auth/session";
import { getCategories, getOpportunityFeed } from "@/lib/data/opportunities";
import { getPeopleDirectory } from "@/lib/data/people";

export default async function AppDiscoverPage({
  searchParams,
}: {
  searchParams: Promise<{
    category?: string;
    q?: string;
    sort?: string;
    type?: string;
  }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const params = await searchParams;
  const opportunityType = getOpportunityFilterType(params.type);
  const [opportunities, categories, peopleResult] = await Promise.all([
    getOpportunityFeed({
      category: params.category,
      q: params.q,
      type: opportunityType,
    }),
    getCategories(),
    getPeopleDirectory(user.id, { q: params.q }),
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
    <DiscoverExperience
      basePath="/app/discover"
      categories={categories}
      mode="app"
      opportunities={opportunities}
      params={params}
      profiles={profiles}
    />
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
