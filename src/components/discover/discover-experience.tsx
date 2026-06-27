import {
  Grid2X2,
  ListFilter,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";

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
  mode = "public",
  opportunities,
  params = {},
  profiles = [],
}: {
  basePath: "/discover" | "/app/discover" | "/market" | "/preview/discover";
  categories: DiscoverCategory[];
  mode?: "public" | "app" | "preview";
  opportunities: DiscoverOpportunity[];
  params?: { category?: string; q?: string; type?: string };
  profiles?: DiscoverProfile[];
}) {
  const typeTabs = [
    ["", "All"],
    ["JOB", "Jobs"],
    ["FREELANCE_PROJECT", "Projects"],
    ["COFOUNDER", "Co-founders"],
    ["STARTUP", "Startups"],
    ["PARTNERSHIP", "Partnerships"],
    ["SERVICE", "Services"],
  ];

  const shellHref = (slug: string) => {
    if (mode === "public") return `/opportunities/${slug}`;
    return `${basePath}?opportunity=${encodeURIComponent(slug)}`;
  };

  return (
    <div className="grid gap-6">
      <section className="perx-hero-card overflow-hidden rounded-[28px] p-6 shadow-[var(--px-shadow)] sm:p-8">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div>
            <p className="text-sm font-bold uppercase tracking-wide text-blue-100">
              Discover
            </p>
            <h1 className="mt-2 text-3xl font-black text-white sm:text-4xl">
              Find opportunities, people and startup collaborators.
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-blue-50">
              Search the perX ecosystem across jobs, freelance projects,
              founders, services, partnerships and future investment
              opportunities.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            {[
              ["2.8k", "Open"],
              ["91%", "Verified"],
              ["₦1.2B", "Deal flow"],
            ].map(([value, label]) => (
              <div
                className="rounded-2xl bg-white/12 px-4 py-3 ring-1 ring-white/15"
                key={label}
              >
                <p className="text-xl font-black text-white">{value}</p>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-100">
                  {label}
                </p>
              </div>
            ))}
          </div>
        </div>

        <form
          action={basePath}
          className="mt-6 grid gap-3 rounded-[22px] bg-white p-4 shadow-[0_18px_44px_rgba(15,23,42,0.16)] ring-1 ring-white/30 md:grid-cols-[minmax(0,1fr)_180px_180px_auto]"
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
              <option value="">All types</option>
              <option value="JOB">Jobs</option>
              <option value="FREELANCE_PROJECT">Freelance projects</option>
              <option value="STARTUP">Startups</option>
              <option value="PARTNERSHIP">Partnerships</option>
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
            <h2 className="font-bold text-[color:var(--px-text)]">Filters</h2>
            <SlidersHorizontal
              size={18}
              className="text-[color:var(--px-text-muted)]"
            />
          </div>
          <div className="mt-5 grid gap-5">
            <FilterGroup title="Location">
              {["Remote", "Lagos", "Abuja", "Global"].map((item) => (
                <FilterCheck key={item} label={item} />
              ))}
            </FilterGroup>
            <FilterGroup title="Budget">
              {["₦250k+", "₦1m+", "₦3m+", "Flexible"].map((item) => (
                <FilterCheck key={item} label={item} />
              ))}
            </FilterGroup>
            <FilterGroup title="Experience">
              {["Entry", "Intermediate", "Expert", "Verified only"].map(
                (item) => (
                  <FilterCheck key={item} label={item} />
                ),
              )}
            </FilterGroup>
          </div>
        </aside>

        <section className="min-w-0">
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
              <button
                className="inline-flex h-10 items-center gap-2 rounded-[var(--px-radius-sm)] border border-[color:var(--px-border)] bg-[color:var(--px-surface-soft)] px-3 text-sm font-semibold text-[color:var(--px-text)] xl:hidden"
                type="button"
              >
                <ListFilter size={16} />
                Filters
              </button>
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
              body="Try a broader search or clear one filter to see more ecosystem opportunities."
              title="No matching opportunities"
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
                "Escrow state supported",
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
              Ecosystem trends
            </h2>
            <div className="mt-4 grid gap-3">
              {[
                ["Startup collaboration", "+18%"],
                ["Design systems", "+12%"],
                ["Secure dashboards", "+24%"],
              ].map(([label, value]) => (
                <div
                  className="flex items-center justify-between rounded-[var(--px-radius-sm)] bg-[color:var(--px-surface-soft)] p-3"
                  key={label}
                >
                  <span className="text-sm font-semibold text-[color:var(--px-text-muted)]">
                    {label}
                  </span>
                  <span className="text-sm font-black text-[color:var(--px-success)]">
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

function FilterGroup({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <fieldset className="grid gap-2">
      <legend className="text-xs font-black uppercase tracking-wide text-[color:var(--px-text)]">
        {title}
      </legend>
      {children}
    </fieldset>
  );
}

function FilterCheck({ label }: { label: string }) {
  return (
    <label className="flex items-center gap-2 text-sm font-semibold text-[color:var(--px-text-muted)]">
      <input
        className="size-4 accent-[color:var(--px-primary)]"
        type="checkbox"
      />
      {label}
    </label>
  );
}
