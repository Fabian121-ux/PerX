import { DiscoverExperience } from "@/components/discover/discover-experience";
import { demoCategories } from "@/lib/data/demo";
import { previewOpportunities } from "@/lib/data/preview";

export default async function PreviewDiscoverPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; q?: string; type?: string }>;
}) {
  const params = await searchParams;
  const filtered = previewOpportunities.filter((opportunity) => {
    const matchesCategory = !params.category || opportunity.category.slug === params.category;
    const matchesType = !params.type || opportunity.type === params.type;
    const matchesQuery =
      !params.q ||
      `${opportunity.title} ${opportunity.summary} ${opportunity.skills.join(" ")}`
        .toLowerCase()
        .includes(params.q.toLowerCase());
    return matchesCategory && matchesType && matchesQuery;
  });

  const profiles = [
    { headline: "Building cross-border services", name: "Maya Chen", role: "Startup Founder", trustScore: 86, username: "maya-client" },
    { headline: "Scaling marketplace MVPs", name: "David Okafor", role: "Full-stack Developer", trustScore: 92, username: "david-okafor" },
    { headline: "Positioning health startups", name: "Amara Nwosu", role: "Brand Strategist", trustScore: 78, username: "amara-nwosu" },
    { headline: "Connecting capital and talent", name: "Tunde Bello", role: "Startup Advisor", trustScore: 95, username: "tunde-bello" },
  ];

  return (
    <DiscoverExperience
      basePath="/preview/discover"
      categories={demoCategories}
      mode="preview"
      opportunities={filtered}
      params={params}
      profiles={profiles}
    />
  );
}
