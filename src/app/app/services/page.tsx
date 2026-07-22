import { AppSection } from "@/components/app-section";
import { getPrisma } from "@/lib/db/prisma";
import { OpportunityCard } from "@/components/opportunity-card";
import { EmptyState } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";

export default async function ServicesPage() {
  const opportunities = await getPrisma().opportunity.findMany({
    where: {
      type: "SERVICE",
      status: "PUBLISHED"
    },
    include: { owner: true },
    orderBy: { createdAt: "desc" }
  });

  return (
    <AppSection
      title="Services"
      description="Discover professional services, agencies, and freelancers ready to help."
      actions={<ButtonLink href="/app/opportunities/new">Post a service</ButtonLink>}
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
          action={<ButtonLink href="/app/opportunities/new">List your service</ButtonLink>}
        />
      )}
    </AppSection>
  );
}
