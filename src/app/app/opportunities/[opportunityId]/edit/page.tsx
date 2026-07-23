import { notFound } from "next/navigation";

import { AppSection } from "@/components/app-section";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { updateOpportunityAction } from "@/features/opportunities/actions";
import { requireUser } from "@/lib/auth/session";
import { getPrisma } from "@/lib/db/prisma";
import {
  currencyOptions,
  opportunityCategoryOptions,
  opportunityTypeOptions,
} from "@/lib/options";

const errors: Record<string, string> = {
  "check-fields": "Please check the highlighted fields and try again.",
  policy: "This content needs changes before it can be published.",
};

export const dynamic = "force-dynamic";

export default async function EditOpportunityPage({
  params,
  searchParams,
}: {
  params: Promise<{ opportunityId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await requireUser();
  const { opportunityId } = await params;
  const query = await searchParams;
  const opportunity = await getPrisma().opportunity.findFirst({
    include: { category: true },
    where: { id: opportunityId, ownerId: user.id },
  });

  if (!opportunity) notFound();

  const action = updateOpportunityAction.bind(null, opportunity.id);

  return (
    <AppSection
      actions={<ButtonLink href="/app/manage" variant="secondary">Back to manage</ButtonLink>}
      description="Edit this item without creating a duplicate record."
      title="Edit content"
    >
      <Card>
        <form action={action} className="grid gap-4">
          {query.error ? (
            <div className="rounded-[var(--px-radius-sm)] bg-red-50 p-3 text-sm font-semibold text-red-700">
              {errors[query.error] ?? "Could not save this item."}
            </div>
          ) : null}
          <Field label="Title">
            <Input defaultValue={opportunity.title} name="title" required />
          </Field>
          <Field label="Summary">
            <Input defaultValue={opportunity.summary} name="summary" required />
          </Field>
          <Field label="Description">
            <Textarea defaultValue={opportunity.description} name="description" required />
          </Field>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Type">
              <Select defaultValue={opportunity.type} name="type" required>
                {opportunityTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Category">
              <Select defaultValue={opportunity.category?.slug ?? "software"} name="category" required>
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
              <Select defaultValue={opportunity.currency} name="currency" required>
                {currencyOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.value}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Budget min">
              <Input defaultValue={minorToInput(opportunity.budgetMinMinor)} name="budgetMin" />
            </Field>
            <Field label="Budget max">
              <Input defaultValue={minorToInput(opportunity.budgetMaxMinor)} name="budgetMax" />
            </Field>
            <Field label="Location">
              <Input defaultValue={opportunity.location ?? ""} name="location" />
            </Field>
          </div>
          <Field label="Skills" hint="Comma-separated skills.">
            <Input defaultValue={opportunity.skills.join(", ")} name="skills" />
          </Field>
          <label className="flex items-center gap-3 text-sm font-medium text-[color:var(--px-text)]">
            <input
              className="size-4 accent-[color:var(--px-primary)]"
              defaultChecked={opportunity.remote}
              name="remote"
              type="checkbox"
            />
            Remote supported
          </label>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button name="intent" type="submit" value="publish">
              Save and publish
            </Button>
            <Button name="intent" type="submit" value="draft" variant="secondary">
              Save changes
            </Button>
            <ButtonLink href={`/app/opportunities/${opportunity.id}`} variant="secondary">
              Preview
            </ButtonLink>
          </div>
        </form>
      </Card>
    </AppSection>
  );
}

function minorToInput(value: bigint | null) {
  if (value === null) return "";
  return (Number(value) / 100).toFixed(2);
}
