import { notFound } from "next/navigation";

import { PublicPageShell } from "@/components/standard-page";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/form";
import { bookmarkOpportunityAction, reportOpportunityAction } from "@/features/opportunities/actions";
import { submitProposalAction } from "@/features/proposals/actions";
import { getOpportunityBySlug } from "@/lib/data/opportunities";
import { formatBudgetRange } from "@/lib/money";

export default async function OpportunityDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const opportunity = await getOpportunityBySlug(slug);
  if (!opportunity) notFound();

  return (
    <PublicPageShell>
      <main className="mx-auto grid max-w-7xl gap-6 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_380px] lg:px-8">
        <section>
          <div className="flex flex-wrap gap-2">
            <Badge>{opportunity.type.replaceAll("_", " ").toLowerCase()}</Badge>
            {opportunity.category ? <Badge>{opportunity.category.name}</Badge> : null}
          </div>
          <h1 className="mt-5 text-4xl font-bold text-slate-950">{opportunity.title}</h1>
          <p className="mt-4 text-lg leading-8 text-slate-600">{opportunity.summary}</p>
          <div className="mt-6 flex flex-wrap gap-2">
            {(opportunity.skills ?? []).map((skill) => (
              <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600" key={skill}>
                {skill}
              </span>
            ))}
          </div>
          <Card className="mt-8">
            <h2 className="text-xl font-semibold text-slate-950">Opportunity details</h2>
            <p className="mt-4 whitespace-pre-line text-sm leading-7 text-slate-600">{opportunity.description}</p>
          </Card>
        </section>
        <aside className="grid gap-5 self-start lg:sticky lg:top-20">
          <Card>
            <p className="text-sm font-medium text-slate-500">Budget</p>
            <p className="mt-1 text-2xl font-bold text-slate-950">
              {formatBudgetRange(opportunity.budgetMinMinor, opportunity.budgetMaxMinor, opportunity.currency)}
            </p>
            <p className="mt-3 text-sm text-slate-600">{opportunity.remote ? "Remote opportunity" : opportunity.location}</p>
            <form action={bookmarkOpportunityAction} className="mt-5">
              <input name="opportunityId" type="hidden" value={opportunity.id} />
              <Button className="w-full" type="submit" variant="secondary">
                Save opportunity
              </Button>
            </form>
          </Card>
          <Card>
            <h2 className="text-lg font-semibold text-slate-950">Submit proposal</h2>
            <form action={submitProposalAction} className="mt-4 grid gap-4">
              <input name="opportunityId" type="hidden" value={opportunity.id} />
              <Field label="Proposed amount">
                <Input name="amount" placeholder="2500.00" required />
              </Field>
              <Field label="Delivery period">
                <Input min={1} name="deliveryDays" required type="number" />
              </Field>
              <Field label="Revisions">
                <Input defaultValue={1} min={0} name="revisions" required type="number" />
              </Field>
              <Field label="Proposal">
                <Textarea name="description" placeholder="Scope, approach, milestones, and acceptance criteria" required />
              </Field>
              <Button type="submit">Send proposal</Button>
              <ButtonLink href="/sign-in" variant="ghost">
                Sign in first if needed
              </ButtonLink>
            </form>
          </Card>
          <Card>
            <h2 className="text-lg font-semibold text-slate-950">Report</h2>
            <form action={reportOpportunityAction} className="mt-4 grid gap-3">
              <input name="opportunityId" type="hidden" value={opportunity.id} />
              <Input name="reason" placeholder="Reason" required />
              <Button type="submit" variant="secondary">
                Report opportunity
              </Button>
            </form>
          </Card>
        </aside>
      </main>
    </PublicPageShell>
  );
}
