import { AppSection } from "@/components/app-section";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { createOpportunityAction } from "@/features/opportunities/actions";
import {
  contactPreferenceOptions,
  currencyOptions,
  findOption,
  opportunityCategoryOptions,
  opportunityTypeOptions,
  propertyListingTypeOptions,
  propertyTypeOptions,
} from "@/lib/options";

const errors: Record<string, string> = {
  "authority-declaration": "Property listings need an ownership or authority declaration of at least 20 characters.",
  "check-fields": "Please check your inputs and try again.",
  "contact-preference": "Choose a contact preference for this property listing.",
  "listing-rules": "Accept the listing rules before submitting a property listing for review.",
  "property-draft-first": "Save this property as a draft first, then upload images before submitting it for review.",
  "property-listing-type": "Choose a property listing type.",
  "property-type": "Choose a property type.",
};

export default async function NewOpportunityPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; error?: string; type?: string }>;
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
  const error = params.error ? errors[params.error] ?? "Could not create this item." : null;
  const propertyMode = defaultType === "PROPERTY";

  return (
    <AppSection description="Create a job, service, property, or collaboration post that can move into proposals, deals, milestones, and trust." title="Create">
      <Card>
        <form action={createOpportunityAction} className="grid gap-4">
          {error ? (
            <div className="rounded-[var(--px-radius-sm)] bg-red-50 p-3 text-sm font-semibold text-red-700">
              {error}
            </div>
          ) : null}
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
          {propertyMode ? (
            <div className="grid gap-4 rounded-[var(--px-radius-sm)] border border-[color:var(--px-border)] bg-[color:var(--px-surface-soft)] p-4">
              <div>
                <h2 className="font-bold text-[color:var(--px-text)]">
                  Property verification
                </h2>
                <p className="mt-1 text-sm text-[color:var(--px-text-muted)]">
                  Save a draft first, then upload images and submit for PerX review.
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <Field label="Property type">
                  <Select name="propertyType" required>
                    <option value="">Choose type</option>
                    {propertyTypeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Listing type">
                  <Select name="propertyListingType" required>
                    <option value="">Choose listing</option>
                    {propertyListingTypeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Contact preference">
                  <Select name="contactPreference" required>
                    <option value="">Choose contact</option>
                    {contactPreferenceOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <Field label="Ownership or authority declaration">
                <Textarea
                  name="authorityDeclaration"
                  placeholder="State your authority to list this property."
                  required
                />
              </Field>
              <label className="flex items-start gap-3 rounded-[var(--px-radius-sm)] bg-[color:var(--px-surface)] p-3 text-sm font-semibold text-[color:var(--px-text)]">
                <input
                  className="mt-0.5 size-4 accent-[color:var(--px-primary)]"
                  name="listingRulesAccepted"
                  type="checkbox"
                />
                <span>
                  I confirm this listing is accurate and understand PerX review does not replace legal property due diligence.
                </span>
              </label>
            </div>
          ) : null}
          <label className="flex items-center gap-3 text-sm font-medium text-slate-700">
            <input className="size-4 accent-emerald-600" defaultChecked name="remote" type="checkbox" />
            Remote supported
          </label>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button name="intent" type="submit" value="publish">
              {propertyMode ? "Submit for review" : "Publish"}
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
