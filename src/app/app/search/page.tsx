import { Search } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { AppSection } from "@/components/app-section";
import { OpportunityCard } from "@/components/opportunity-card";
import { FeatureResultCard } from "@/components/search/feature-result-card";
import { PeopleResultCard } from "@/components/search/people-result-card";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/form";
import { requireUser } from "@/lib/auth/session";
import {
  getUnifiedSearchResults,
  type UnifiedSearchResults,
} from "@/lib/data/search";
import { roleLabels } from "@/lib/permissions/capabilities";
import {
  buildSearchHref,
  formatSearchPriceRange,
  parseSearchFilters,
  searchCategoryOptions,
  type ParsedSearchFilters,
  type SearchCategory,
  type SearchQueryParams,
} from "@/lib/search";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function UnifiedSearchPage({
  searchParams,
}: {
  searchParams: Promise<SearchQueryParams>;
}) {
  const [user, rawParams] = await Promise.all([requireUser(), searchParams]);
  const filters = parseSearchFilters(rawParams);
  const results = await getUnifiedSearchResults(user, filters);
  const priceRange = formatSearchPriceRange(filters);
  const searchesPeople = ["all", "people"].includes(filters.category);
  const searchesListings = ["all", "products", "services"].includes(
    filters.category,
  );

  return (
    <AppSection
      actions={<CategoryAction category={filters.category} />}
      description="Find discoverable members, real product and service listings, and available PerX destinations from one authenticated search."
      title="Search PerX"
    >
      <div className="grid gap-6">
        <Card className="grid gap-5">
          <nav
            aria-label="Search categories"
            className="grid grid-cols-2 gap-2 sm:grid-cols-5"
          >
            {searchCategoryOptions.map((option) => {
              const active = option.value === filters.category;
              return (
                <Link
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "rounded-[var(--px-radius-sm)] border px-3 py-2.5 text-center text-sm font-bold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)]",
                    active
                      ? "border-[color:var(--px-primary)] bg-[color:var(--px-primary)] text-white"
                      : "border-[color:var(--px-border)] bg-[color:var(--px-surface-soft)] text-[color:var(--px-text-muted)] hover:border-[color:var(--px-border-strong)] hover:text-[color:var(--px-text)]",
                  )}
                  href={buildSearchHref(filters, {
                    category: option.value,
                    cursor: null,
                  })}
                  key={option.value}
                >
                  {option.label}
                </Link>
              );
            })}
          </nav>

          <form
            className="grid gap-4 md:grid-cols-2 xl:grid-cols-6"
            role="search"
          >
            <input name="category" type="hidden" value={filters.category} />
            <label className="relative md:col-span-2 xl:col-span-2">
              <span className="mb-1 block text-xs font-bold text-[color:var(--px-text-muted)]">
                Search
              </span>
              <span className="relative block">
                <Search
                  aria-hidden
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--px-text-muted)]"
                  size={17}
                />
                <Input
                  className="w-full pl-10"
                  defaultValue={filters.q}
                  name="q"
                  placeholder={
                    filters.category === "features"
                      ? "Try escrow, messages, or settings"
                      : "Names, listings, skills, or features"
                  }
                  type="search"
                />
              </span>
            </label>

            {filters.category !== "features" ? (
              <label>
                <span className="mb-1 block text-xs font-bold text-[color:var(--px-text-muted)]">
                  Location
                </span>
                <Input
                  className="w-full"
                  defaultValue={filters.location}
                  name="location"
                  placeholder="City or region"
                />
              </label>
            ) : null}

            {searchesPeople ? (
              <>
                <label>
                  <span className="mb-1 block text-xs font-bold text-[color:var(--px-text-muted)]">
                    Skill
                  </span>
                  <Input
                    className="w-full"
                    defaultValue={filters.skill}
                    name="skill"
                    placeholder="Skill"
                  />
                </label>
                <label>
                  <span className="mb-1 block text-xs font-bold text-[color:var(--px-text-muted)]">
                    Role
                  </span>
                  <Select
                    className="w-full"
                    defaultValue={filters.role ?? ""}
                    name="role"
                  >
                    <option value="">Any role</option>
                    {Object.entries(roleLabels)
                      .filter(
                        ([role]) =>
                          ![
                            "ADMIN",
                            "MASTER_ADMIN",
                            "INTERNAL_TESTER",
                          ].includes(role),
                      )
                      .map(([role, label]) => (
                        <option key={role} value={role}>
                          {label}
                        </option>
                      ))}
                  </Select>
                </label>
              </>
            ) : null}

            {searchesListings ? (
              <>
                <label>
                  <span className="mb-1 block text-xs font-bold text-[color:var(--px-text-muted)]">
                    Minimum price (NGN)
                  </span>
                  <Input
                    className="w-full"
                    defaultValue={filters.minPrice}
                    inputMode="decimal"
                    name="minPrice"
                    placeholder="0.00"
                  />
                </label>
                <label>
                  <span className="mb-1 block text-xs font-bold text-[color:var(--px-text-muted)]">
                    Maximum price (NGN)
                  </span>
                  <Input
                    className="w-full"
                    defaultValue={filters.maxPrice}
                    inputMode="decimal"
                    name="maxPrice"
                    placeholder="500000.00"
                  />
                </label>
              </>
            ) : null}

            <Button className="w-full self-end" type="submit">
              Search
            </Button>
          </form>

          {filters.priceError ? (
            <div
              className="rounded-[var(--px-radius-sm)] border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700"
              role="alert"
            >
              {filters.priceError}
            </div>
          ) : priceRange ? (
            <p className="text-sm font-semibold text-[color:var(--px-text-muted)]">
              Listing price filter: {priceRange}
            </p>
          ) : null}
        </Card>

        {filters.category === "all" ? (
          <AllResults filters={filters} results={results} />
        ) : (
          <CategoryResults filters={filters} results={results} />
        )}
      </div>
    </AppSection>
  );
}

function CategoryAction({ category }: { category: SearchCategory }) {
  if (category === "products") {
    return (
      <ButtonLink href="/app/opportunities/new?type=PRODUCT&category=market">
        List a product
      </ButtonLink>
    );
  }
  if (category === "services") {
    return (
      <ButtonLink href="/app/opportunities/new?type=SERVICE&category=services">
        Offer a service
      </ButtonLink>
    );
  }
  return null;
}

function AllResults({
  filters,
  results,
}: {
  filters: ParsedSearchFilters;
  results: UnifiedSearchResults;
}) {
  return (
    <div className="grid gap-9">
      <ResultSection
        description="Discoverable members matching your people filters."
        title="People"
        viewAllHref={buildSearchHref(filters, {
          category: "people",
          cursor: null,
        })}
      >
        {results.people?.items.length ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {results.people.items.map((person) => (
              <PeopleResultCard key={person.id} person={person} />
            ))}
          </div>
        ) : (
          <InlineEmpty body="No discoverable people match these filters." />
        )}
      </ResultSection>

      <ResultSection
        description="Eligible published product listings from PerX members."
        title="Products"
        viewAllHref={buildSearchHref(filters, {
          category: "products",
          cursor: null,
        })}
      >
        {filters.priceError ? (
          <InlineEmpty body="Correct the price range to search product listings." />
        ) : results.products?.items.length ? (
          <div className="grid gap-5 xl:grid-cols-2">
            {results.products.items.map((product) => (
              <OpportunityCard key={product.id} opportunity={product} />
            ))}
          </div>
        ) : (
          <InlineEmpty body="No eligible published products match these filters." />
        )}
      </ResultSection>

      <ResultSection
        description="Eligible published service listings from PerX members."
        title="Services"
        viewAllHref={buildSearchHref(filters, {
          category: "services",
          cursor: null,
        })}
      >
        {filters.priceError ? (
          <InlineEmpty body="Correct the price range to search service listings." />
        ) : results.services?.items.length ? (
          <div className="grid gap-5 xl:grid-cols-2">
            {results.services.items.map((service) => (
              <OpportunityCard key={service.id} opportunity={service} />
            ))}
          </div>
        ) : (
          <InlineEmpty body="No eligible published services match these filters." />
        )}
      </ResultSection>

      <ResultSection
        description="Destinations from the central PerX feature registry."
        title="Features"
        viewAllHref={buildSearchHref(filters, {
          category: "features",
          cursor: null,
        })}
      >
        {results.features?.length ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {results.features.map((feature) => (
              <FeatureResultCard feature={feature} key={feature.id} />
            ))}
          </div>
        ) : (
          <InlineEmpty body="No app features match this search." />
        )}
      </ResultSection>
    </div>
  );
}

function CategoryResults({
  filters,
  results,
}: {
  filters: ParsedSearchFilters;
  results: UnifiedSearchResults;
}) {
  if (filters.category === "people") {
    return results.people?.items.length ? (
      <div className="grid gap-5">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {results.people.items.map((person) => (
            <PeopleResultCard key={person.id} person={person} />
          ))}
        </div>
        <CursorPagination
          filters={filters}
          label="People pagination"
          nextCursor={results.people.nextCursor}
        />
      </div>
    ) : (
      <EmptyState
        action={
          <ButtonLink href="/app/search?category=people" variant="secondary">
            Clear filters
          </ButtonLink>
        }
        body="Try a broader name, location, skill, or role search. Only members who opted into discovery appear here."
        title="No discoverable people found"
      />
    );
  }

  if (filters.category === "products") {
    if (filters.priceError) {
      return (
        <EmptyState
          body="Correct the NGN minimum and maximum price fields, then search again."
          title="Product search needs a valid price range"
        />
      );
    }
    return results.products?.items.length ? (
      <div className="grid gap-5">
        <div className="grid gap-5 xl:grid-cols-2">
          {results.products.items.map((product) => (
            <OpportunityCard key={product.id} opportunity={product} />
          ))}
        </div>
        <CursorPagination
          filters={filters}
          label="Product pagination"
          nextCursor={results.products.nextCursor}
        />
      </div>
    ) : (
      <EmptyState
        action={
          <ButtonLink href="/app/opportunities/new?type=PRODUCT&category=market">
            List a product
          </ButtonLink>
        }
        body="No eligible published product listings match these filters. No placeholder products were substituted."
        title="No products found"
      />
    );
  }

  if (filters.category === "services") {
    if (filters.priceError) {
      return (
        <EmptyState
          body="Correct the NGN minimum and maximum price fields, then search again."
          title="Service search needs a valid price range"
        />
      );
    }
    return results.services?.items.length ? (
      <div className="grid gap-5">
        <div className="grid gap-5 xl:grid-cols-2">
          {results.services.items.map((service) => (
            <OpportunityCard key={service.id} opportunity={service} />
          ))}
        </div>
        <CursorPagination
          filters={filters}
          label="Service pagination"
          nextCursor={results.services.nextCursor}
        />
      </div>
    ) : (
      <EmptyState
        action={
          <ButtonLink href="/app/opportunities/new?type=SERVICE&category=services">
            Offer a service
          </ButtonLink>
        }
        body="No eligible published service listings match these filters. No placeholder services were substituted."
        title="No services found"
      />
    );
  }

  return results.features?.length ? (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {results.features.map((feature) => (
        <FeatureResultCard feature={feature} key={feature.id} />
      ))}
    </div>
  ) : (
    <EmptyState
      action={
        <ButtonLink href="/app/search?category=features" variant="secondary">
          Clear search
        </ButtonLink>
      }
      body="Try a destination or task such as messages, escrow, settings, or support."
      title="No matching features"
    />
  );
}

function ResultSection({
  children,
  description,
  title,
  viewAllHref,
}: {
  children: ReactNode;
  description: string;
  title: string;
  viewAllHref: string;
}) {
  const headingId = `search-results-${title.toLocaleLowerCase()}`;
  return (
    <section aria-labelledby={headingId} className="grid gap-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h2
            className="text-xl font-black text-[color:var(--px-text)]"
            id={headingId}
          >
            {title}
          </h2>
          <p className="mt-1 text-sm text-[color:var(--px-text-muted)]">
            {description}
          </p>
        </div>
        <ButtonLink href={viewAllHref} size="sm" variant="secondary">
          View all {title.toLocaleLowerCase()}
        </ButtonLink>
      </div>
      {children}
    </section>
  );
}

function InlineEmpty({ body }: { body: string }) {
  return (
    <div className="rounded-[var(--px-radius)] border border-dashed border-[color:var(--px-border-strong)] bg-[color:var(--px-surface-soft)] px-5 py-8 text-center text-sm font-semibold text-[color:var(--px-text-muted)]">
      {body}
    </div>
  );
}

function CursorPagination({
  filters,
  label,
  nextCursor,
}: {
  filters: ParsedSearchFilters;
  label: string;
  nextCursor: string | null;
}) {
  if (!filters.cursor && !nextCursor) return null;

  return (
    <nav
      aria-label={label}
      className="flex flex-col justify-center gap-2 sm:flex-row"
    >
      {filters.cursor ? (
        <ButtonLink
          href={buildSearchHref(filters, { cursor: null })}
          variant="secondary"
        >
          First page
        </ButtonLink>
      ) : null}
      {nextCursor ? (
        <ButtonLink
          href={buildSearchHref(filters, { cursor: nextCursor })}
          variant="secondary"
        >
          Next
        </ButtonLink>
      ) : null}
    </nav>
  );
}
