import { AppSection } from "@/components/app-section";
import { logisticsV1Enabled } from "@/lib/logistics/v1-policy";
import { getPublishedSectionOpportunities } from "@/lib/data/section-opportunities";
import { OpportunityCard } from "@/components/opportunity-card";
import { EmptyState } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";

export default async function LogisticsPage() {
  const opportunities = await getPublishedSectionOpportunities({
    category: "logistics",
    type: "SERVICE",
  });

  return (
    <AppSection
      title="Logistics"
      description="Connect with freight, shipping, and supply chain partners."
      actions={<ButtonLink href="/app/opportunities/new?type=SERVICE&category=logistics">Post a request</ButtonLink>}
    >
      {logisticsV1Enabled() ? (
        <div className="flex flex-wrap gap-3 rounded-2xl border border-[color:var(--px-border)] bg-[color:var(--px-surface)] p-4">
          <div className="flex-1"><p className="font-black text-[color:var(--px-text)]">Logistics V1 pilot</p><p className="text-sm text-[color:var(--px-text-muted)]">Deliveries use existing product agreements. Drivers must accept and enable GPS themselves.</p></div>
          <ButtonLink href="/app/logistics/driver" variant="secondary">Driver dashboard</ButtonLink>
          <ButtonLink href="/app/track" variant="secondary">Track deliveries</ButtonLink>
        </div>
      ) : null}
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
          action={<ButtonLink href="/app/opportunities/new?type=SERVICE&category=logistics">Post an opportunity</ButtonLink>}
        />
      )}
    </AppSection>
  );
}
