import {
  Grid2X2,
  Search,
  ShieldCheck,
  SlidersHorizontal,
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
  params?: { category?: string; q?: string; type?: string };
  profiles?: DiscoverProfile[];
}) {
  const typeTabs = [
    ["", "All listings"],
    ["JOB", "Jobs"],
    ["FREELANCE_PROJECT", "Projects"],
    ["STARTUP", "Startups"],
    ["COFOUNDER", "Co-founders"],
    ["PARTNERSHIP", "Partnerships"],
    ["SERVICE", "Services"],
  ];

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
              {typeTabs.map(([value, label]) => (
                <option key={value || "all"} value={value}>
                  {label}
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
        {typeTabs.map(([value, label]) => {
          const active = (params.type ?? "") === value;
          const href = value ? `${basePath}?type=${value}` : basePath;
          return (
            <a
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold ring-1 transition ${
                active
                  ? "bg-[color:var(--px-primary)] text-white ring-[color:var(--px-primary)]"
                  : "bg-[color:var(--px-surface)] text-[color:var(--px-text-muted)] ring-[color:var(--px-border)] hover:text-[color:var(--px-primary)]"
              }`}
              href={href}
              key={label}
            >
              {label}
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
                {typeTabs.map(([value, label]) => (
                  <option key={value || "all"} value={value}>
                    {label}
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
              <h2 className="text-sm font-bold">Discovery is temporarily unavailable</h2>
              <p className="mt-2 text-sm leading-6 text-amber-900">
                Opportunity search could not reach the database. Please try again shortly.
              </p>
            </Card>
          ) : null}

          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[20px] bg-[color:var(--px-surface)] px-4 py-3 shadow-sm ring-1 ring-[color:var(--px-border)]">
            <div>
              <p className="text-sm font-bold text-[color:var(--px-text)]">
                {opportunities.length} results
              </p>
              <p className="text-xs text-[color:var(--px-text-muted)]">
                Sorted by trust, relevance and recent activity
              </p>
            </div>
            <div className="flex items-center gap-2">
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

          {opportunities.length ? (
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
              title={dataUnavailable ? "Discovery unavailable" : "No matching opportunities"}
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
