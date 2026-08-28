import { OpportunityComposer } from "@/components/opportunities/opportunity-composer";
import {
  creatableOpportunityTypeOptions,
  defaultOpportunityCategoryByType,
  findOption,
  opportunityCategoryOptions,
} from "@/lib/options";
import { TraderAccessGate } from "@/components/trader/trader-access-gate";
import { requireUser } from "@/lib/auth/session";
import { getOwnTraderApplication, isTrader } from "@/lib/trader/access";

const errors: Record<string, string> = {
  "authority-declaration":
    "Property listings need an ownership or authority declaration of at least 20 characters.",
  "contact-preference":
    "Choose a contact preference for this property listing.",
  "database-not-configured":
    "Creation is temporarily unavailable. Please try again later.",
  "listing-rules":
    "Accept the listing rules before submitting a property listing for review.",
  "property-draft-first":
    "Save this property as a draft first, then upload images before submitting it for review.",
  "property-listing-type": "Choose a property listing type.",
  "property-type": "Choose a property type.",
  "type-unavailable":
    "That post type is not available for publishing on PerX yet.",
};

export default async function NewOpportunityPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; error?: string; type?: string }>;
}) {
  /*
    Authenticated first, authorized second.

    This route previously called `requireCapabilityOrNotFound`, so a signed-in
    member without trading access was told "This PerX page is not available" -
    the page does exist, they simply have not been granted access yet, and the
    404 gave them no way to find that out.

    `notFound()` is still correct where concealing existence is the point
    (unknown ids, other people's private records, the whole admin area). Create
    is a first-class, advertised product action, so it explains itself instead.
    The protected composer is never rendered or sent to the client here.
  */
  const user = await requireUser();
  if (!isTrader(user.roles)) {
    const application = await getOwnTraderApplication(user.id).catch(
      () => null,
    );
    return <TraderAccessGate application={application} />;
  }

  const params = await searchParams;
  const defaultType = findOption(
    creatableOpportunityTypeOptions,
    params.type ?? "",
  )
    ? params.type
    : "FREELANCE_PROJECT";
  const fallbackCategory =
    defaultOpportunityCategoryByType[
      (defaultType ??
        "FREELANCE_PROJECT") as keyof typeof defaultOpportunityCategoryByType
    ];
  const defaultCategory = findOption(
    opportunityCategoryOptions,
    params.category ?? "",
  )
    ? params.category
    : fallbackCategory;
  const error = params.error
    ? (errors[params.error] ?? "Could not create this item.")
    : null;
  return (
    <OpportunityComposer
      defaultCategory={defaultCategory ?? "software"}
      defaultType={defaultType ?? "FREELANCE_PROJECT"}
      error={error}
      userId={user.id}
    />
  );
}
