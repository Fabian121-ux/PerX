import { notFound } from "next/navigation";

import { AppSection } from "@/components/app-section";
import { ListingImageManager } from "@/components/opportunities/listing-image-manager";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { updateOpportunityAction } from "@/features/opportunities/actions";
import { requireUser } from "@/lib/auth/session";
import { getPrisma } from "@/lib/db/prisma";
import { getServerEnv } from "@/lib/env";
import {
  contactPreferenceOptions,
  currencyOptions,
  opportunityCategoryOptions,
  opportunityTypeOptions,
  propertyListingTypeOptions,
  propertyTypeOptions,
} from "@/lib/options";
import { isListingImageStorageConfigured } from "@/lib/uploads/listing-image";

const errors: Record<string, string> = {
  "authority-declaration": "Property listings need an ownership or authority declaration of at least 20 characters.",
  "check-fields": "Please check the highlighted fields and try again.",
  "contact-preference": "Choose a contact preference for this property listing.",
  "listing-rules": "Accept the listing rules before submitting a property listing for review.",
  policy: "This content needs changes before it can be published.",
  "property-image": "Upload at least one property image and choose a cover image before submitting for review.",
  "property-listing-type": "Choose a property listing type.",
  "property-requirements": "Complete the property listing requirements before publishing.",
  "property-type": "Choose a property type.",
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
    include: {
      category: true,
      images: { orderBy: [{ isCover: "desc" }, { createdAt: "asc" }] },
    },
    where: { id: opportunityId, ownerId: user.id },
  });

  if (!opportunity) notFound();

  const action = updateOpportunityAction.bind(null, opportunity.id);
  const storageEnabled = isListingImageStorageConfigured();
  const env = getServerEnv();

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
          {opportunity.type === "PROPERTY" ? (
            <div className="grid gap-4 rounded-[var(--px-radius-sm)] border border-[color:var(--px-border)] bg-[color:var(--px-surface-soft)] p-4">
              <div>
                <h2 className="font-bold text-[color:var(--px-text)]">
                  Property verification
                </h2>
                <p className="mt-1 text-sm text-[color:var(--px-text-muted)]">
                  Property listings remain private until images, declaration, policy checks, and PerX review are complete.
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <Field label="Property type">
                  <Select
                    defaultValue={opportunity.propertyType ?? ""}
                    name="propertyType"
                    required
                  >
                    <option value="">Choose type</option>
                    {propertyTypeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Listing type">
                  <Select
                    defaultValue={opportunity.propertyListingType ?? ""}
                    name="propertyListingType"
                    required
                  >
                    <option value="">Choose listing</option>
                    {propertyListingTypeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Contact preference">
                  <Select
                    defaultValue={opportunity.contactPreference ?? ""}
                    name="contactPreference"
                    required
                  >
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
                  defaultValue={opportunity.authorityDeclaration ?? ""}
                  name="authorityDeclaration"
                  placeholder="State your authority to list this property. Private verification documents are handled through admin review, not public pages."
                  required
                />
              </Field>
              <label className="flex items-start gap-3 rounded-[var(--px-radius-sm)] bg-[color:var(--px-surface)] p-3 text-sm font-semibold text-[color:var(--px-text)]">
                <input
                  className="mt-0.5 size-4 accent-[color:var(--px-primary)]"
                  defaultChecked={opportunity.listingRulesAccepted}
                  name="listingRulesAccepted"
                  type="checkbox"
                />
                <span>
                  I confirm this listing is accurate and understand PerX review does not replace legal property due diligence.
                </span>
              </label>
            </div>
          ) : null}
          {opportunity.type === "PROPERTY" ? (
            <ListingImageManager
              images={opportunity.images.map((image) => ({
                id: image.id,
                isCover: image.isCover,
                url: image.url,
              }))}
              maxBytes={env.UPLOAD_MAX_BYTES}
              opportunityId={opportunity.id}
              storageEnabled={storageEnabled}
            />
          ) : null}
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
