import { AppSection } from "@/components/app-section";
import { getPrisma } from "@/lib/db/prisma";
import { OpportunityCard } from "@/components/opportunity-card";
import { EmptyState } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";

export default async function LogisticsPage() {
  const opportunities = await getPrisma().opportunity.findMany({
    where: {
      type: "SERVICE", // In absence of LOGISTICS enum, matching SERVICE for now
      status: "PUBLISHED",
      categoryId: { not: null } // Just finding published services, logistics should have a category in future
    },
    include: { owner: true },
    orderBy: { createdAt: "desc" }
  });

  return (
    <AppSection
      title="Logistics"
      description="Connect with freight, shipping, and supply chain partners."
      actions={<ButtonLink href="/app/opportunities/new">Post a request</ButtonLink>}
    >
      {opportunities.length > 0 ? (
        <div className="grid gap-5 xl:grid-cols-2">
          {opportunities.map((opportunity) => (
            <OpportunityCard key={opportunity.slug} opportunity={opportunity} />
          ))}
        </div>
      ) : (
        <EmptyState
          title="No logistics partners found"
          body="Logistics opportunities and requests will appear here."
          action={<ButtonLink href="/app/opportunities/new">Post an opportunity</ButtonLink>}
        />
      )}
    </AppSection>
  );
}
