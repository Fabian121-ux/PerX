import { AppSection } from "@/components/app-section";
import { getPublishedSectionOpportunityPage } from "@/lib/data/section-opportunities";
import { OpportunityCard } from "@/components/opportunity-card";
import { EmptyState } from "@/components/ui/card";
import { Button, ButtonLink } from "@/components/ui/button";
import { Input } from "@/components/ui/form";

export default async function ServicesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const params = await searchParams;
  const page = Number(params.page ?? 1);
  const q = params.q?.trim() ?? "";
  const result = await getPublishedSectionOpportunityPage({
    category: "services",
    page: Number.isFinite(page) ? page : 1,
    q,
    type: "SERVICE",
  });

  return (
    <AppSection
      title="Services"
      description="Discover professional services, agencies, and freelancers ready to help."
      actions={<ButtonLink href="/app/opportunities/new?type=SERVICE&category=services">Post a service</ButtonLink>}
    >
      <div className="grid gap-5">
        <form className="grid gap-3 rounded-[var(--px-radius)] border border-[color:var(--px-border)] bg-[color:var(--px-surface)] p-4 sm:grid-cols-[minmax(0,1fr)_auto]">
          <label>
            <span className="sr-only">Search services</span>
            <Input
              defaultValue={q}
              name="q"
              placeholder="Search services by title, summary, or skill"
            />
          </label>
          <Button className="w-full sm:w-auto" type="submit" variant="secondary">
            Search
          </Button>
        </form>

        {result.items.length > 0 ? (
          <>
            <p className="text-sm font-semibold text-[color:var(--px-text-muted)]">
              {result.total} published service{result.total === 1 ? "" : "s"}
            </p>
            <div className="grid gap-5 xl:grid-cols-2">
              {result.items.map((opportunity) => (
                <OpportunityCard key={opportunity.slug} opportunity={opportunity} />
              ))}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
              {result.hasPreviousPage ? (
                <ButtonLink
                  href={`/app/services?${new URLSearchParams({
                    ...(q ? { q } : {}),
                    page: String(result.page - 1),
                  }).toString()}`}
                  variant="secondary"
                >
                  Previous
                </ButtonLink>
              ) : null}
              {result.hasNextPage ? (
                <ButtonLink
                  href={`/app/services?${new URLSearchParams({
                    ...(q ? { q } : {}),
                    page: String(result.page + 1),
                  }).toString()}`}
                  variant="secondary"
                >
                  Next
                </ButtonLink>
              ) : null}
            </div>
          </>
        ) : (
          <EmptyState
            title="No services found"
            body={
              q
                ? "No published services match that search yet."
                : "There are currently no published services in this category."
            }
            action={<ButtonLink href="/app/opportunities/new?type=SERVICE&category=services">List your service</ButtonLink>}
          />
        )}
      </div>
    </AppSection>
  );
}
