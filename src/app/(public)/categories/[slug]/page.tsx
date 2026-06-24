import { PublicPageShell } from "@/components/standard-page";
import { OpportunityCard } from "@/components/opportunity-card";
import { getCategories, getOpportunityFeed } from "@/lib/data/opportunities";

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [categories, opportunities] = await Promise.all([getCategories(), getOpportunityFeed({ category: slug })]);
  const category = categories.find((item) => item.slug === slug);

  return (
    <PublicPageShell>
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">Category</p>
        <h1 className="mt-3 text-4xl font-bold text-slate-950">{category?.name ?? "Category"}</h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">{category?.description ?? "Explore matching opportunities."}</p>
        <div className="mt-8 grid gap-5 lg:grid-cols-2">
          {opportunities.map((opportunity) => (
            <OpportunityCard key={opportunity.slug} opportunity={opportunity} />
          ))}
        </div>
      </main>
    </PublicPageShell>
  );
}
