import { AppSection } from "@/components/app-section";
import { getPublishedSectionOpportunities } from "@/lib/data/section-opportunities";
import { OpportunityCard } from "@/components/opportunity-card";
import { EmptyState } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";

export default async function ServicesPage() {
  const opportunities = await getPublishedSectionOpportunities({
    category: "services",
    type: "SERVICE",
  });

  return (
    <AppSection
      title="Services"
      description="Discover professional services, agencies, and freelancers ready to help."
      actions={<ButtonLink href="/app/opportunities/new?type=SERVICE&category=services">Post a service</ButtonLink>}
    >
      {opportunities.length > 0 ? (
        <div className="grid gap-5 xl:grid-cols-2">
          {opportunities.map((opportunity) => (
            <OpportunityCard key={opportunity.slug} opportunity={opportunity} />
          ))}
        </div>
      ) : (
        <EmptyState
          title="No services found"
          body="There are currently no published services in this category."
          action={<ButtonLink href="/app/opportunities/new?type=SERVICE&category=services">List your service</ButtonLink>}
        />
      )}
    </AppSection>
  );
}
