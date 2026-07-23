import { AppSection } from "@/components/app-section";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { createOpportunityAction } from "@/features/opportunities/actions";
import {
  currencyOptions,
  findOption,
  opportunityCategoryOptions,
  opportunityTypeOptions,
} from "@/lib/options";

export default async function NewOpportunityPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; type?: string }>;
}) {
  const params = await searchParams;
  const defaultType = findOption(opportunityTypeOptions, params.type ?? "")
    ? params.type
    : "FREELANCE_PROJECT";
  const defaultCategory = findOption(
    opportunityCategoryOptions,
    params.category ?? "",
  )
    ? params.category
    : "software";

  return (
    <AppSection description="Create a job or freelance project that can move into proposals, deals, milestones, and trust." title="Create opportunity">
      <Card>
        <form action={createOpportunityAction} className="grid gap-4">
          <Field label="Title">
            <Input name="title" required />
          </Field>
          <Field label="Summary">
            <Input name="summary" required />
          </Field>
          <Field label="Description">
            <Textarea name="description" required />
          </Field>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Type">
              <Select defaultValue={defaultType} name="type" required>
                {opportunityTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Category">
              <Select defaultValue={defaultCategory} name="category" required>
                {opportunityCategoryOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="grid gap-4 md:grid-cols-4">
            <Field label="Currency">
              <Select defaultValue="NGN" name="currency" required>
                {currencyOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.value}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Budget min">
              <Input name="budgetMin" placeholder="250000.00" />
            </Field>
            <Field label="Budget max">
              <Input name="budgetMax" placeholder="1200000.00" />
            </Field>
            <Field label="Location">
              <Input name="location" placeholder="Lagos, remote, hybrid" />
            </Field>
          </div>
          <Field label="Skills">
            <Input name="skills" placeholder="Next.js, Prisma, Security" />
          </Field>
          <label className="flex items-center gap-3 text-sm font-medium text-slate-700">
            <input className="size-4 accent-emerald-600" defaultChecked name="remote" type="checkbox" />
            Remote supported
          </label>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button name="intent" type="submit" value="publish">
              Publish
            </Button>
            <Button name="intent" type="submit" value="draft" variant="secondary">
              Save draft
            </Button>
          </div>
        </form>
      </Card>
    </AppSection>
  );
}
