import { OpportunityComposer } from "@/components/opportunities/opportunity-composer";
import {
  creatableOpportunityTypeOptions,
  defaultOpportunityCategoryByType,
  findOption,
  opportunityCategoryOptions,
} from "@/lib/options";
import { requireCapabilityOrNotFound } from "@/lib/auth/session";

const errors: Record<string, string> = {
  "authority-declaration": "Property listings need an ownership or authority declaration of at least 20 characters.",
  "check-fields": "Please check your inputs and try again.",
  "contact-preference": "Choose a contact preference for this property listing.",
  "database-not-configured": "Creation is temporarily unavailable. Please try again later.",
  "listing-rules": "Accept the listing rules before submitting a property listing for review.",
  "property-draft-first": "Save this property as a draft first, then upload images before submitting it for review.",
  "property-listing-type": "Choose a property listing type.",
  "property-type": "Choose a property type.",
  "type-unavailable": "That post type is not available for publishing on PerX yet.",
};

export default async function NewOpportunityPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; error?: string; type?: string }>;
}) {
  await requireCapabilityOrNotFound("opportunity:create");
  const params = await searchParams;
  const defaultType = findOption(creatableOpportunityTypeOptions, params.type ?? "")
    ? params.type
    : "FREELANCE_PROJECT";
  const fallbackCategory =
    defaultOpportunityCategoryByType[
      (defaultType ?? "FREELANCE_PROJECT") as keyof typeof defaultOpportunityCategoryByType
    ];
  const defaultCategory = findOption(
    opportunityCategoryOptions,
    params.category ?? "",
  )
    ? params.category
    : fallbackCategory;
  const error = params.error ? errors[params.error] ?? "Could not create this item." : null;
  return (
    <OpportunityComposer
      defaultCategory={defaultCategory ?? "software"}
      defaultType={defaultType ?? "FREELANCE_PROJECT"}
      error={error}
    />
  );
}
