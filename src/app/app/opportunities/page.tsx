/* eslint-disable @typescript-eslint/no-explicit-any */
import { AppSection } from "@/components/app-section";
import { OpportunityCard } from "@/components/opportunity-card";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/session";
import { getMyOpportunities } from "@/lib/data/opportunities";

export default async function MyOpportunitiesPage() {
  const user = await getCurrentUser();
  const opportunities = await getMyOpportunities(user!.id);

  return (
    <AppSection
      actions={
        <ButtonLink href="/app/opportunities/new">New opportunity</ButtonLink>
      }
      description="Manage drafts, published opportunities, moderation status, and ownership."
      title="My listings"
    >
      {opportunities.length ? (
        <div className="grid gap-5 xl:grid-cols-2">
          {opportunities.map((opportunity: any) => (
            <OpportunityCard key={opportunity.slug} opportunity={opportunity} />
          ))}
        </div>
      ) : (
        <EmptyState
          action={
            <ButtonLink href="/app/opportunities/new">
              Create opportunity
            </ButtonLink>
          }
          body="Your persisted opportunities will appear here after you create them."
          title="No opportunities yet"
        />
      )}
    </AppSection>
  );
}
