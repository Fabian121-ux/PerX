import { AppSection } from "@/components/app-section";
import { getPrisma } from "@/lib/db/prisma";
import { OpportunityCard } from "@/components/opportunity-card";
import { EmptyState } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";

export default async function MarketPage() {
  const opportunities = await getPrisma().opportunity.findMany({
    where: {
      status: "PUBLISHED"
    },
    include: { owner: true },
    orderBy: { createdAt: "desc" },
    take: 50 // Limit for general marketplace
  });

  return (
    <AppSection
      title="Global Market"
      description="Browse all published opportunities across the PerX ecosystem."
      actions={<ButtonLink href="/app/opportunities/new">Post an opportunity</ButtonLink>}
    >
      {opportunities.length > 0 ? (
        <div className="grid gap-5 xl:grid-cols-2">
          {opportunities.map((opportunity) => (
            <OpportunityCard key={opportunity.slug} opportunity={opportunity} />
          ))}
        </div>
      ) : (
        <EmptyState
          title="No opportunities found"
          body="There are currently no published opportunities in the market."
          action={<ButtonLink href="/app/opportunities/new">Create the first</ButtonLink>}
        />
      )}
    </AppSection>
  );
}
