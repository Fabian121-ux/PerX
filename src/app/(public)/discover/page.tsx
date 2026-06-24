import { Search } from "lucide-react";

import { PublicPageShell } from "@/components/standard-page";
import { OpportunityCard } from "@/components/opportunity-card";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form";
import { getCategories, getOpportunityFeed } from "@/lib/data/opportunities";

export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; q?: string; type?: string }>;
}) {
  const params = await searchParams;
  const [opportunities, categories] = await Promise.all([
    getOpportunityFeed({ category: params.category, q: params.q, type: params.type }),
    getCategories(),
  ]);

  return (
    <PublicPageShell>
      <main>
        <section className="prex-hero text-white">
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
            <div className="max-w-3xl">
              <p className="text-sm font-semibold uppercase tracking-wide text-[color:var(--px-gold)]">Discover</p>
              <h1 className="mt-3 text-4xl font-bold text-white">Find structured opportunities</h1>
              <p className="mt-3 text-base leading-7 text-blue-50">
                Search jobs and freelance projects that can move into conversations, proposals, deals, escrow states, and reputation.
              </p>
            </div>
          </div>
        </section>
        <div className="mx-auto max-w-7xl px-4 pb-14 sm:px-6 lg:px-8">
          <form className="-mt-8 grid gap-4 rounded-[var(--px-radius)] border border-[color:var(--px-border)] bg-white p-4 shadow-[var(--px-shadow-lg)] md:grid-cols-[1fr_220px_220px_auto]">
            <Field label="Search">
              <Input defaultValue={params.q} name="q" placeholder="Skill, role, or keyword" />
            </Field>
            <Field label="Type">
              <Select defaultValue={params.type ?? ""} name="type">
                <option value="">All</option>
                <option value="JOB">Jobs</option>
                <option value="FREELANCE_PROJECT">Freelance projects</option>
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
          <div className="mt-8 grid gap-5 lg:grid-cols-2">
            {opportunities.map((opportunity) => (
              <OpportunityCard key={opportunity.slug} opportunity={opportunity} />
            ))}
          </div>
        </div>
      </main>
    </PublicPageShell>
  );
}
