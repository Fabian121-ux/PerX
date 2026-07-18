import { PublicPageShell } from "@/components/standard-page";
import { OpportunityCard } from "@/components/opportunity-card";
import { EmptyState } from "@/components/ui/card";
import {
  getCategoriesResult,
  getOpportunityFeedResult,
} from "@/lib/data/opportunities";

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [categoryResult, opportunityResult] = await Promise.all([
    getCategoriesResult(),
    getOpportunityFeedResult({ category: slug }),
  ]);
  const category = categoryResult.categories.find((item) => item.slug === slug);
  const unavailable = categoryResult.unavailable || opportunityResult.unavailable;

  return (
    <PublicPageShell>
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">Category</p>
        <h1 className="mt-3 text-4xl font-bold text-slate-950">{category?.name ?? "Category"}</h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">{category?.description ?? "Explore matching opportunities."}</p>
        {unavailable ? (
          <div className="mt-8">
            <EmptyState
              body="Please try again shortly."
              title="This section is temporarily unavailable."
            />
          </div>
        ) : (
          <div className="mt-8 grid gap-5 lg:grid-cols-2">
            {opportunityResult.opportunities.map((opportunity) => (
              <OpportunityCard key={opportunity.slug} opportunity={opportunity} />
            ))}
          </div>
        )}
      </main>
    </PublicPageShell>
  );
}
