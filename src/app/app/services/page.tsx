import { AppSection } from "@/components/app-section";
import { getPublishedSectionOpportunityPageResult } from "@/lib/data/section-opportunities";
import { OpportunityCard } from "@/components/opportunity-card";
import { EmptyState } from "@/components/ui/card";
import { Button, ButtonLink } from "@/components/ui/button";
import { Input } from "@/components/ui/form";

export default async function ServicesPage({
  searchParams,
}: {
  searchParams: Promise<{
    cursor?: string;
    location?: string;
    maxPrice?: string;
    minPrice?: string;
    q?: string;
  }>;
}) {
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const location = params.location?.trim() ?? "";
  const minPrice = params.minPrice?.trim() ?? "";
  const maxPrice = params.maxPrice?.trim() ?? "";
  const result = await getPublishedSectionOpportunityPageResult({
    cursor: params.cursor,
    location,
    maxPrice,
    minPrice,
    q,
    type: "SERVICE",
  });
  const servicePageHref = (cursor?: string) => {
    const search = new URLSearchParams({
      ...(location ? { location } : {}),
      ...(maxPrice ? { maxPrice } : {}),
      ...(minPrice ? { minPrice } : {}),
      ...(q ? { q } : {}),
      ...(cursor ? { cursor } : {}),
    });
    const query = search.toString();
    return query ? `/app/services?${query}` : "/app/services";
  };
  const hasFilters = Boolean(q || location || minPrice || maxPrice);

  return (
    <AppSection
      title="Services"
      description="Discover professional services, agencies, and freelancers ready to help."
      actions={
        <ButtonLink href="/app/opportunities/new?type=SERVICE&category=services">
          Post a service
        </ButtonLink>
      }
    >
      <div className="grid gap-5">
        <form className="grid gap-3 rounded-[var(--px-radius)] border border-[color:var(--px-border)] bg-[color:var(--px-surface)] p-4 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(130px,0.7fr)_minmax(130px,0.7fr)_auto]">
          <label>
            <span className="mb-1 block text-xs font-bold text-[color:var(--px-text-muted)]">
              Search
            </span>
            <Input
              defaultValue={q}
              name="q"
              placeholder="Search services by title, summary, or skill"
            />
          </label>
          <label>
            <span className="mb-1 block text-xs font-bold text-[color:var(--px-text-muted)]">
              Location
            </span>
            <Input
              defaultValue={location}
              name="location"
              placeholder="City or region"
            />
          </label>
          <label>
            <span className="mb-1 block text-xs font-bold text-[color:var(--px-text-muted)]">
              Minimum price
            </span>
            <Input
              defaultValue={minPrice}
              inputMode="decimal"
              min="0"
              name="minPrice"
              placeholder="0.00"
              step="0.01"
              type="number"
            />
          </label>
          <label>
            <span className="mb-1 block text-xs font-bold text-[color:var(--px-text-muted)]">
              Maximum price
            </span>
            <Input
              defaultValue={maxPrice}
              inputMode="decimal"
              min="0"
              name="maxPrice"
              placeholder="5000.00"
              step="0.01"
              type="number"
            />
          </label>
          <Button
            className="w-full self-end sm:w-auto"
            type="submit"
            variant="secondary"
          >
            Search
          </Button>
        </form>

        {result.unavailable ? (
          <EmptyState
            title="Services are temporarily unavailable"
            body="The database-backed service feed could not be loaded. No mock listings were substituted."
            action={<ButtonLink href="/app/services">Try again</ButtonLink>}
          />
        ) : result.items.length > 0 ? (
          <>
            <p className="text-sm font-semibold text-[color:var(--px-text-muted)]">
              {result.total} published service{result.total === 1 ? "" : "s"}
            </p>
            <div className="grid gap-5 xl:grid-cols-2">
              {result.items.map((opportunity) => (
                <OpportunityCard
                  key={opportunity.slug}
                  opportunity={opportunity}
                />
              ))}
            </div>
            <nav
              aria-label="Service pagination"
              className="flex flex-col gap-2 sm:flex-row sm:justify-center"
            >
              {result.cursor ? (
                <ButtonLink href={servicePageHref()} variant="secondary">
                  First page
                </ButtonLink>
              ) : null}
              {result.nextCursor ? (
                <ButtonLink
                  href={servicePageHref(result.nextCursor)}
                  variant="secondary"
                >
                  Next
                </ButtonLink>
              ) : null}
            </nav>
          </>
        ) : (
          <EmptyState
            title="No services found"
            body={
              hasFilters
                ? "No eligible published services match those filters."
                : "There are currently no eligible published services."
            }
            action={
              <ButtonLink href="/app/opportunities/new?type=SERVICE&category=services">
                List your service
              </ButtonLink>
            }
          />
        )}
      </div>
    </AppSection>
  );
}
