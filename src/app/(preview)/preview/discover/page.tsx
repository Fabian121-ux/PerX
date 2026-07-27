import { DiscoverExperience } from "@/components/discover/discover-experience";
import { demoCategories } from "@/lib/data/demo";
import { previewOpportunities } from "@/lib/data/preview";
import { calculateTrustSummary } from "@/lib/trust/engine";

export default async function PreviewDiscoverPage({
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
  const filtered = previewOpportunities.filter((opportunity) => {
    const matchesCategory =
      !params.category || opportunity.category.slug === params.category;
    const matchesType =
      !opportunityType || opportunity.type === opportunityType;
    const matchesQuery =
      !params.q ||
      `${opportunity.title} ${opportunity.summary} ${opportunity.skills.join(" ")}`
        .toLowerCase()
        .includes(params.q.toLowerCase());
    return matchesCategory && matchesType && matchesQuery;
  });

  const profiles = [
    {
      headline: "Building cross-border services",
      name: "Maya Chen",
      role: "Startup Founder",
      trust: calculateTrustSummary({
        completedDeals: 1,
        emailVerifiedAt: new Date().toISOString(),
        profileCompleteness: 86,
      }),
      username: "maya-client",
    },
    {
      headline: "Scaling marketplace MVPs",
      name: "David Okafor",
      role: "Full-stack Developer",
      trust: calculateTrustSummary({
        completedDeals: 3,
        emailVerifiedAt: new Date().toISOString(),
        profileCompleteness: 92,
        verificationStatus: "VERIFIED",
      }),
      username: "david-okafor",
    },
    {
      headline: "Positioning health startups",
      name: "Amara Nwosu",
      role: "Brand Strategist",
      trust: calculateTrustSummary({
        emailVerifiedAt: new Date().toISOString(),
        profileCompleteness: 78,
      }),
      username: "amara-nwosu",
    },
    {
      headline: "Connecting capital and talent",
      name: "Tunde Bello",
      role: "Startup Advisor",
      trust: calculateTrustSummary({
        averageRating: 4.7,
        completedDeals: 5,
        emailVerifiedAt: new Date().toISOString(),
        profileCompleteness: 95,
        verificationStatus: "VERIFIED",
      }),
      username: "tunde-bello",
    },
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
