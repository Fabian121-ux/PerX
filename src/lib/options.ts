export const opportunityTypeValues = [
  "FREELANCE_PROJECT",
  "JOB",
  "SERVICE",
  "PRODUCT",
  "PROPERTY",
  "PARTNERSHIP",
  "STARTUP",
  "COFOUNDER",
  "INVESTMENT",
] as const;

/**
 * Opportunity types that are no longer offered in the product.
 *
 * These values are intentionally still present in `opportunityTypeValues` and
 * in the database: existing rows must keep validating, keep rendering a human
 * label, and remain moderatable by admins. They are simply removed from every
 * surface where a user chooses a type.
 *
 * PROPERTY backed the retired "Real Estate" vertical.
 */
export const retiredOpportunityTypeValues = ["PROPERTY"] as const;

export function isRetiredOpportunityType(value: string): boolean {
  return (retiredOpportunityTypeValues as readonly string[]).includes(value);
}

/**
 * Every known type with a display label, including retired ones.
 *
 * Use this ONLY to label data that already exists. For anything the user picks
 * from, use `creatableOpportunityTypeOptions`.
 */
export const opportunityTypeOptions = [
  { label: "Freelance project", value: "FREELANCE_PROJECT" },
  { label: "Job", value: "JOB" },
  { label: "Service", value: "SERVICE" },
  { label: "Product", value: "PRODUCT" },
  { label: "Property", value: "PROPERTY" },
  { label: "Partnership", value: "PARTNERSHIP" },
  { label: "Startup", value: "STARTUP" },
  { label: "Cofounder", value: "COFOUNDER" },
  { label: "Investment", value: "INVESTMENT" },
] as const;

/** Types a user may actually choose when creating or editing a post. */
export const creatableOpportunityTypeOptions = opportunityTypeOptions.filter(
  (option) =>
    option.value !== "INVESTMENT" && !isRetiredOpportunityType(option.value),
);

export const defaultOpportunityCategoryByType = {
  COFOUNDER: "startups",
  FREELANCE_PROJECT: "software",
  JOB: "operations",
  PARTNERSHIP: "startups",
  PRODUCT: "market",
  PROPERTY: "real-estate",
  SERVICE: "services",
  STARTUP: "startups",
} as const;

export const opportunityCategoryValues = [
  "software",
  "design",
  "operations",
  "real-estate",
  "logistics",
  "travel-stay",
  "services",
  "startups",
  "market",
] as const;

/**
 * Categories retired from the product experience.
 *
 * Kept in `opportunityCategoryValues` and in `allOpportunityCategoryOptions`
 * so existing rows still validate and still render a label, but excluded from
 * every selection surface. See `retiredOpportunityTypeValues`.
 */
export const retiredOpportunityCategoryValues = ["real-estate"] as const;

export function isRetiredOpportunityCategory(value: string): boolean {
  return (retiredOpportunityCategoryValues as readonly string[]).includes(
    value,
  );
}

/** Every known category with a display label, including retired ones. */
export const allOpportunityCategoryOptions = [
  {
    description: "Product engineering, automation, and infrastructure work.",
    label: "Software",
    value: "software",
  },
  {
    description: "Brand, product, UX, and visual design opportunities.",
    label: "Design",
    value: "design",
  },
  {
    description: "Business operations, growth, and process work.",
    label: "Operations",
    value: "operations",
  },
  {
    description: "Homes, land, rentals, and property services.",
    label: "Property",
    value: "real-estate",
  },
  {
    description: "Transport, fulfillment, dispatch, and logistics work.",
    label: "Logistics",
    value: "logistics",
  },
  {
    description: "Travel, stays, hospitality, and itinerary services.",
    label: "Travel and stay",
    value: "travel-stay",
  },
  {
    description: "Professional services offered through PerX.",
    label: "Services",
    value: "services",
  },
  {
    description: "Startup, cofounder, and investor collaboration.",
    label: "Startups",
    value: "startups",
  },
  {
    description: "Marketplace listings and commerce enquiries.",
    label: "Market",
    value: "market",
  },
] as const;

/** Categories a user may actually choose when creating or editing a post. */
export const opportunityCategoryOptions = allOpportunityCategoryOptions.filter(
  (option) => !isRetiredOpportunityCategory(option.value),
);

type LabelledOption = { readonly label: string; readonly value: string };

/**
 * Selection options for an EDIT form.
 *
 * Retired values are hidden from new selections, but an existing record that
 * already holds one must still show it - otherwise the `<select>` would silently
 * change the record's type/category the moment the owner saves an unrelated
 * field, which is data loss disguised as a UI cleanup.
 */
function withCurrentValue<T extends LabelledOption>(
  available: readonly T[],
  all: readonly T[],
  currentValue: string | null | undefined,
): readonly T[] {
  if (!currentValue) return available;
  if (available.some((option) => option.value === currentValue)) {
    return available;
  }
  const retained = all.find((option) => option.value === currentValue);
  return retained ? [retained, ...available] : available;
}

export function editableOpportunityTypeOptions(currentValue?: string | null) {
  return withCurrentValue(
    creatableOpportunityTypeOptions,
    opportunityTypeOptions,
    currentValue,
  );
}

export function editableOpportunityCategoryOptions(
  currentValue?: string | null,
) {
  return withCurrentValue(
    opportunityCategoryOptions,
    allOpportunityCategoryOptions,
    currentValue,
  );
}

export const currencyValues = ["NGN", "USD", "EUR", "GBP"] as const;

export const currencyOptions = [
  { label: "Nigerian naira", value: "NGN" },
  { label: "US dollar", value: "USD" },
  { label: "Euro", value: "EUR" },
  { label: "British pound", value: "GBP" },
] as const;

export const propertyTypeValues = [
  "APARTMENT",
  "HOUSE",
  "LAND",
  "COMMERCIAL",
  "SHORT_STAY",
] as const;

export const propertyTypeOptions = [
  { label: "Apartment", value: "APARTMENT" },
  { label: "House", value: "HOUSE" },
  { label: "Land", value: "LAND" },
  { label: "Commercial property", value: "COMMERCIAL" },
  { label: "Short stay", value: "SHORT_STAY" },
] as const;

export const propertyListingTypeValues = ["SALE", "RENT", "LEASE", "CO_INVESTMENT"] as const;

export const propertyListingTypeOptions = [
  { label: "For sale", value: "SALE" },
  { label: "For rent", value: "RENT" },
  { label: "Lease", value: "LEASE" },
  { label: "Co-investment", value: "CO_INVESTMENT" },
] as const;

export const contactPreferenceValues = ["PERX_MESSAGES", "PHONE_AFTER_CONNECTION", "EMAIL_AFTER_CONNECTION"] as const;

export const contactPreferenceOptions = [
  { label: "PerX messages", value: "PERX_MESSAGES" },
  { label: "Phone after connection", value: "PHONE_AFTER_CONNECTION" },
  { label: "Email after connection", value: "EMAIL_AFTER_CONNECTION" },
] as const;

export const reportReasonValues = [
  "SPAM",
  "SCAM_OR_FRAUD",
  "HARASSMENT",
  "THREAT_OR_SAFETY",
  "IMPERSONATION",
  "PROHIBITED_CONTENT",
  "PRIVACY_CONCERN",
  "MISLEADING_INFORMATION",
  "UNSAFE_PAYMENT",
  "OTHER",
] as const;

export const reportReasonOptions = [
  { label: "Spam", value: "SPAM" },
  { label: "Scam or fraud", value: "SCAM_OR_FRAUD" },
  { label: "Harassment", value: "HARASSMENT" },
  { label: "Threat or safety concern", value: "THREAT_OR_SAFETY" },
  { label: "Impersonation", value: "IMPERSONATION" },
  { label: "Prohibited content", value: "PROHIBITED_CONTENT" },
  { label: "Suspicious payment request", value: "UNSAFE_PAYMENT" },
  { label: "Privacy concern", value: "PRIVACY_CONCERN" },
  { label: "Misleading information", value: "MISLEADING_INFORMATION" },
  { label: "Other", value: "OTHER" },
] as const;

export const supportCategoryValues = [
  "ACCOUNT",
  "DEAL",
  "TRUST",
  "TECHNICAL",
  "OTHER",
] as const;

export const supportCategoryOptions = [
  { label: "Account access", value: "ACCOUNT" },
  { label: "Deal and escrow", value: "DEAL" },
  { label: "Trust and moderation", value: "TRUST" },
  { label: "Technical issue", value: "TECHNICAL" },
  { label: "Other", value: "OTHER" },
] as const;

export function findOption<
  TOption extends { label: string; value: string },
>(options: readonly TOption[], value: string) {
  return options.find((option) => option.value === value) ?? null;
}
