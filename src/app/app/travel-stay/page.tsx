import { AppSection } from "@/components/app-section";
import { getPublishedSectionOpportunities } from "@/lib/data/section-opportunities";
import { OpportunityCard } from "@/components/opportunity-card";
import { EmptyState } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";

export default async function TravelStayPage() {
  const opportunities = await getPublishedSectionOpportunities({
    category: "travel-stay",
    type: "PROPERTY",
  });

  return (
    <AppSection
      title="Travel & Stay"
      description="Book short-term rentals and travel experiences."
      actions={<ButtonLink href="/app/opportunities/new?type=PROPERTY&category=travel-stay">List a rental</ButtonLink>}
    >
      {opportunities.length > 0 ? (
        <div className="grid gap-5 xl:grid-cols-2">
          {opportunities.map((opportunity) => (
            <OpportunityCard key={opportunity.slug} opportunity={opportunity} />
          ))}
        </div>
      ) : (
        <EmptyState
          title="No travel listings found"
          body="Short-term rentals and travel opportunities will appear here."
          action={<ButtonLink href="/app/opportunities/new?type=PROPERTY&category=travel-stay">Post a listing</ButtonLink>}
        />
      )}
    </AppSection>
  );
}
