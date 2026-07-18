import {
  Building2,
  BriefcaseBusiness,
  Grid2X2,
  Handshake,
  Search,
  ShieldCheck,
  ShoppingBag,
  SlidersHorizontal,
  UserRound,
  Users,
} from "lucide-react";

import { MobileFilterDrawer } from "@/components/discover/filter-drawer";
import { OpportunityCard } from "@/components/opportunity-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/form";

type DiscoverOpportunity = Parameters<typeof OpportunityCard>[0]["opportunity"];

type DiscoverCategory = {
  name: string;
  slug: string;
};

type DiscoverProfile = {
  headline: string;
  name: string;
  role: string;
  trustScore: number;
  username: string;
};

export function DiscoverExperience({
  basePath,
  categories,
  dataUnavailable = false,
  mode = "public",
  opportunities,
  params = {},
  profiles = [],
}: {
  basePath: "/discover" | "/app/discover" | "/market" | "/preview/discover";
  categories: DiscoverCategory[];
  dataUnavailable?: boolean;
  mode?: "public" | "app" | "preview";
  opportunities: DiscoverOpportunity[];
  params?: { category?: string; q?: string; sort?: string; type?: string };
  profiles?: DiscoverProfile[];
}) {
  const typeTabs = [
    { icon: Grid2X2, label: "All", value: "" },
    { icon: BriefcaseBusiness, label: "Opportunities", value: "OPPORTUNITY" },
    { icon: UserRound, label: "People", value: "PEOPLE" },
    { icon: BriefcaseBusiness, label: "Work", value: "JOB" },
    { icon: UserRound, label: "Services", value: "SERVICE" },
    { icon: Handshake, label: "Partnerships", value: "PARTNERSHIP" },
    { icon: Building2, label: "Businesses", value: "BUSINESS" },
    { icon: ShoppingBag, label: "Marketplace", value: "MARKETPLACE" },
  ];
  const activeType = params.type ?? "";
  const showPeople = activeType === "PEOPLE";
  const unavailableView =
    activeType === "BUSINESS"
      ? "Businesses"
      : activeType === "MARKETPLACE"
        ? "Marketplace"
        : null;
  const resultCount = showPeople
    ? profiles.length
    : unavailableView
      ? 0
      : opportunities.length;

  const tabHref = (value: string) => {
    const searchParams = new URLSearchParams();
    if (value) searchParams.set("type", value);
    if (params.q) searchParams.set("q", params.q);
    if (params.category) searchParams.set("category", params.category);
    if (params.sort) searchParams.set("sort", params.sort);
    const query = searchParams.toString();
    return query ? `${basePath}?${query}` : basePath;
  };

  const shellHref = (slug: string) => {
    if (mode === "public") return `/opportunities/${slug}`;
    return `${basePath}?opportunity=${encodeURIComponent(slug)}`;
  };

  return (
    <div className="grid gap-6">
      <section className="overflow-hidden rounded-[24px] border border-[color:var(--px-border)] bg-[color:var(--px-surface)] p-5 shadow-[var(--px-shadow)] sm:p-6">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div>
            <p className="text-sm font-bold uppercase tracking-wide text-[color:var(--px-primary)]">
              Discovery
            </p>
            <h1 className="mt-2 text-3xl font-black text-[color:var(--px-text)] sm:text-4xl">
              Find trusted people, work and business opportunities.
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[color:var(--px-text-muted)]">
              Search across active perX listings with simple filters, clear
              trust indicators and enquiry-first marketplace behavior during
              beta.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              ["People", "Profiles"],
              ["Work", "Listings"],
              ["Trust", "Signals"],
            ].map(([value, label]) => (
              <div
                className="rounded-2xl bg-[color:var(--px-surface-soft)] px-3 py-3 ring-1 ring-[color:var(--px-border)]"
                key={label}
              >
                <p className="text-sm font-black text-[color:var(--px-text)]">
                  {value}
                </p>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--px-text-muted)]">
                  {label}
                </p>
              </div>
            ))}
          </div>
        </div>

        <form
          action={basePath}
          className="mt-5 grid gap-3 rounded-[18px] border border-[color:var(--px-border)] bg-[color:var(--px-surface-soft)] p-3 md:grid-cols-[minmax(0,1fr)_180px_180px_auto]"
        >
          <Field label="Search">
            <Input
              defaultValue={params.q}
              name="q"
              placeholder="Role, skill, company or keyword"
            />
          </Field>
          <Field label="Type">
            <Select defaultValue={params.type ?? ""} name="type">
              {typeTabs.map((tab) => (
                <option key={tab.value || "all"} value={tab.value}>
                  {tab.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Category">
            <Select defaultValue={params.category ?? ""} name="category">
              <option value="">All categories</option>
              {categories.map((category) => (
                <option key={category.slug} value={category.slug}>
                  {category.name}
                </option>
              ))}
            </Select>
          </Field>
          <Button className="self-end" type="submit">
            <Search aria-hidden className="mr-2" size={16} />
            Search
          </Button>
        </form>
      </section>

      <div className="dashboard-scroll -mx-4 flex gap-2 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0">
        {typeTabs.map((tab) => {
          const active = activeType === tab.value;
          const Icon = tab.icon;
          return (
            <a
              className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-bold ring-1 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)] ${
                active
                  ? "bg-[color:var(--px-primary)] text-white ring-[color:var(--px-primary)]"
                  : "bg-[color:var(--px-surface)] text-[color:var(--px-text-muted)] ring-[color:var(--px-border)] hover:text-[color:var(--px-primary)]"
              }`}
              href={tabHref(tab.value)}
              key={tab.label}
            >
              <Icon aria-hidden size={15} />
              {tab.label}
            </a>
          );
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)_320px]">
        <aside className="hidden self-start rounded-[24px] bg-[color:var(--px-surface)] p-5 shadow-sm ring-1 ring-[color:var(--px-border)] xl:block">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-[color:var(--px-text)]">Refine</h2>
            <SlidersHorizontal
              size={18}
              className="text-[color:var(--px-text-muted)]"
            />
          </div>
          <form action={basePath} className="mt-5 grid gap-4">
            <Field label="Search">
              <Input
                defaultValue={params.q}
                name="q"
                placeholder="Skill, role or company"
              />
            </Field>
            <Field label="Type">
              <Select defaultValue={params.type ?? ""} name="type">
                {typeTabs.map((tab) => (
                  <option key={tab.value || "all"} value={tab.value}>
                    {tab.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Category">
              <Select defaultValue={params.category ?? ""} name="category">
                <option value="">All categories</option>
                {categories.map((category) => (
                  <option key={category.slug} value={category.slug}>
                    {category.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Button type="submit" variant="secondary">
              Apply filters
            </Button>
          </form>
        </aside>

        <section className="min-w-0">
          {dataUnavailable ? (
            <Card className="mb-4 border-amber-200 bg-amber-50 text-amber-950">
              <h2 className="text-sm font-bold">
                Discovery is temporarily unavailable
              </h2>
              <p className="mt-2 text-sm leading-6 text-amber-900">
                Opportunity search could not reach the database. Please try
                again shortly.
              </p>
            </Card>
          ) : null}

          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[var(--px-radius)] bg-[color:var(--px-surface)] px-4 py-3 shadow-sm ring-1 ring-[color:var(--px-border)]">
            <div>
              <p className="text-sm font-bold text-[color:var(--px-text)]">
                {resultCount} results
              </p>
              <p className="text-xs text-[color:var(--px-text-muted)]">
                Sorted by trust, relevance and recent activity
              </p>
            </div>
            <div className="flex items-center gap-2">
              <form
                action={basePath}
                className="hidden items-center gap-2 sm:flex"
              >
                {params.q ? (
                  <input name="q" type="hidden" value={params.q} />
                ) : null}
                {params.type ? (
                  <input name="type" type="hidden" value={params.type} />
                ) : null}
                {params.category ? (
                  <input
                    name="category"
                    type="hidden"
                    value={params.category}
                  />
                ) : null}
                <label className="sr-only" htmlFor="discover-sort">
                  Sort results
                </label>
                <Select
                  className="min-h-10"
                  defaultValue={params.sort ?? "relevance"}
                  id="discover-sort"
                  name="sort"
                >
                  <option value="relevance">Relevant</option>
                  <option value="recent">Recent</option>
                  <option value="trust">Trust</option>
                </Select>
                <Button size="sm" type="submit" variant="secondary">
                  Sort
                </Button>
              </form>
              <MobileFilterDrawer
                basePath={basePath}
                categories={categories}
                params={params}
              />
              <button
                className="grid h-10 w-10 place-items-center rounded-[var(--px-radius-sm)] bg-[color:var(--px-primary-soft)] text-[color:var(--px-primary)]"
                aria-label="Grid view"
                type="button"
              >
                <Grid2X2 size={17} />
              </button>
            </div>
          </div>

          {showPeople ? (
            profiles.length ? (
              <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
                {profiles.map((profile) => (
                  <PersonDiscoveryCard
                    key={profile.username}
                    mode={mode}
                    profile={profile}
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                body="People results will appear after members complete searchable profiles."
                title="No matching people"
              />
            )
          ) : unavailableView ? (
            <UnavailableDiscoveryState view={unavailableView} />
          ) : opportunities.length ? (
            <div className="grid gap-5 lg:grid-cols-2 2xl:grid-cols-3">
              {opportunities.map((opportunity) => (
                <OpportunityCard
                  href={shellHref(opportunity.slug)}
                  key={opportunity.slug}
                  opportunity={opportunity}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              body={
                dataUnavailable
                  ? "The database-backed discovery feed is unavailable. No mock results were substituted."
                  : "Try a broader search or clear one filter to see more ecosystem opportunities."
              }
              title={
                dataUnavailable
                  ? "Discovery unavailable"
                  : "No matching opportunities"
              }
            />
          )}

          <div className="mt-6 flex items-center justify-between rounded-[20px] bg-[color:var(--px-surface)] px-4 py-3 text-sm ring-1 ring-[color:var(--px-border)]">
            <span className="font-semibold text-[color:var(--px-text-muted)]">
              Page 1 of 1
            </span>
            <div className="flex gap-2">
              <button
                className="rounded-[var(--px-radius-sm)] border border-[color:var(--px-border)] px-3 py-2 font-semibold text-[color:var(--px-text-muted)]"
                type="button"
                disabled
              >
                Previous
              </button>
              <button
                className="rounded-[var(--px-radius-sm)] border border-[color:var(--px-border)] px-3 py-2 font-semibold text-[color:var(--px-text-muted)]"
                type="button"
                disabled
              >
                Next
              </button>
            </div>
          </div>
        </section>

        <aside className="grid gap-5 self-start">
          <Card>
            <h2 className="font-bold text-[color:var(--px-text)]">
              Trust signals
            </h2>
            <div className="mt-4 grid gap-3">
              {[
                "Verified profiles first",
                "Proposal-ready opportunities",
                "Agreement-state supported",
                "Moderation reviewed",
              ].map((item) => (
                <div
                  className="flex items-center gap-3 rounded-[var(--px-radius-sm)] bg-[color:var(--px-surface-soft)] p-3"
                  key={item}
                >
                  <ShieldCheck
                    className="text-[color:var(--px-success)]"
                    size={17}
                  />
                  <span className="text-sm font-semibold text-[color:var(--px-text-muted)]">
                    {item}
                  </span>
                </div>
              ))}
            </div>
          </Card>

          {profiles.length ? (
            <Card>
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-[color:var(--px-text)]">
                  People to connect
                </h2>
                <Users size={18} className="text-[color:var(--px-primary)]" />
              </div>
              <div className="mt-4 grid gap-3">
                {profiles.slice(0, 4).map((profile) => (
                  <div
                    className="flex items-center gap-3 rounded-[var(--px-radius-sm)] bg-[color:var(--px-surface-soft)] p-3"
                    key={profile.username}
                  >
                    <div className="grid h-10 w-10 place-items-center rounded-full bg-[color:var(--px-primary)] text-xs font-black text-white">
                      {profile.name
                        .split(" ")
                        .map((part) => part[0])
                        .join("")
                        .slice(0, 2)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-[color:var(--px-text)]">
                        {profile.name}
                      </p>
                      <p className="truncate text-xs text-[color:var(--px-text-muted)]">
                        {profile.role}
                      </p>
                    </div>
                    <Badge className="bg-green-50 text-green-800">
                      Trust {profile.trustScore}
                    </Badge>
                  </div>
                ))}
              </div>
            </Card>
          ) : null}

          <Card>
            <h2 className="font-bold text-[color:var(--px-text)]">
              Discovery guide
            </h2>
            <div className="mt-4 grid gap-3">
              {[
                ["Startups", "Profiles and collaboration"],
                ["Services", "Worker-led offers"],
                ["Marketplace", "Enquiry only in beta"],
              ].map(([label, value]) => (
                <div
                  className="flex items-center justify-between rounded-[var(--px-radius-sm)] bg-[color:var(--px-surface-soft)] p-3"
                  key={label}
                >
                  <span className="text-sm font-semibold text-[color:var(--px-text-muted)]">
                    {label}
                  </span>
                  <span className="text-right text-xs font-black uppercase tracking-wide text-[color:var(--px-primary)]">
                    {value}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function PersonDiscoveryCard({
  mode,
  profile,
}: {
  mode: "public" | "app" | "preview";
  profile: DiscoverProfile;
}) {
  const initials = profile.name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const href =
    mode === "preview" ? "/preview/profile" : `/u/${profile.username}`;

  return (
    <Card className="flex min-h-[230px] flex-col justify-between gap-5">
      <div>
        <div className="flex items-start gap-3">
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-[color:var(--px-primary)] text-base font-black text-white">
            {initials}
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-black text-[color:var(--px-text)]">
              {profile.name}
            </h2>
            <p className="mt-1 line-clamp-2 text-sm leading-6 text-[color:var(--px-text-muted)]">
              {profile.headline}
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge>{profile.role}</Badge>
          <Badge className="border-green-200 bg-green-50 text-green-800">
            <ShieldCheck aria-hidden className="mr-1" size={13} />
            Trust {profile.trustScore}
          </Badge>
        </div>
      </div>
      <a
        className="inline-flex min-h-11 items-center justify-center rounded-[var(--px-radius-sm)] bg-[color:var(--px-primary)] px-4 text-sm font-bold text-white transition hover:bg-[color:var(--px-primary-strong)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)]"
        href={href}
      >
        View profile
      </a>
    </Card>
  );
}

function UnavailableDiscoveryState({ view }: { view: string }) {
  const marketplace = view === "Marketplace";

  return (
    <Card className="grid gap-4 border-dashed text-center">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-[var(--px-radius-sm)] bg-[color:var(--px-primary-soft)] text-[color:var(--px-primary)]">
        {marketplace ? (
          <ShoppingBag aria-hidden size={22} />
        ) : (
          <Building2 aria-hidden size={22} />
        )}
      </div>
      <div>
        <h2 className="text-lg font-black text-[color:var(--px-text)]">
          {view} discovery is coming later
        </h2>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[color:var(--px-text-muted)]">
          {marketplace
            ? "PerX commercial listings remain enquiry-based during beta. Checkout, payment, escrow and settlement are not active."
            : "Business discovery is being prepared as a dedicated beta surface. No fixture businesses were substituted for live data."}
        </p>
      </div>
    </Card>
  );
}
