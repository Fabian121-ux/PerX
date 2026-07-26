import { AppSection } from "@/components/app-section";
import { getPublishedSectionOpportunities } from "@/lib/data/section-opportunities";
import { OpportunityCard } from "@/components/opportunity-card";
import { EmptyState } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";

export default async function RealEstatePage() {
  const opportunities = await getPublishedSectionOpportunities({
    category: "real-estate",
    type: "PROPERTY",
  });

  return (
    <AppSection
      title="Real Estate"
      description="Discover properties, co-investments, and real estate opportunities."
      actions={<ButtonLink href="/app/opportunities/new?type=PROPERTY&category=real-estate">List property</ButtonLink>}
    >
      {opportunities.length > 0 ? (
        <div className="grid gap-5 xl:grid-cols-2">
          {opportunities.map((opportunity) => (
            <OpportunityCard key={opportunity.slug} opportunity={opportunity} />
          ))}
        </div>
      ) : (
        <EmptyState
          title="No properties found"
          body="There are currently no published real estate opportunities."
          action={<ButtonLink href="/app/opportunities/new?type=PROPERTY&category=real-estate">List a property</ButtonLink>}
        />
      )}
    </AppSection>
  );
}
