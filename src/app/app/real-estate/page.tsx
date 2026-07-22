import { AppSection } from "@/components/app-section";
import { getPrisma } from "@/lib/db/prisma";
import { OpportunityCard } from "@/components/opportunity-card";
import { EmptyState } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";

export default async function RealEstatePage() {
  const opportunities = await getPrisma().opportunity.findMany({
    where: {
      type: "PROPERTY",
      status: "PUBLISHED"
    },
    include: { owner: true },
    orderBy: { createdAt: "desc" }
  });

  return (
    <AppSection
      title="Real Estate"
      description="Discover properties, co-investments, and real estate opportunities."
      actions={<ButtonLink href="/app/opportunities/new">List property</ButtonLink>}
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
          action={<ButtonLink href="/app/opportunities/new">List a property</ButtonLink>}
        />
      )}
    </AppSection>
  );
}
