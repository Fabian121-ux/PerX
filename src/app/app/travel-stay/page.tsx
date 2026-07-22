import { AppSection } from "@/components/app-section";
import { getPrisma } from "@/lib/db/prisma";
import { OpportunityCard } from "@/components/opportunity-card";
import { EmptyState } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";

export default async function TravelStayPage() {
  const opportunities = await getPrisma().opportunity.findMany({
    where: {
      type: "PROPERTY", // Closest fit for Travel & Stay
      status: "PUBLISHED"
    },
    include: { owner: true },
    orderBy: { createdAt: "desc" }
  });

  return (
    <AppSection
      title="Travel & Stay"
      description="Book short-term rentals and travel experiences."
      actions={<ButtonLink href="/app/opportunities/new">List a rental</ButtonLink>}
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
          action={<ButtonLink href="/app/opportunities/new">Post a listing</ButtonLink>}
        />
      )}
    </AppSection>
  );
}
