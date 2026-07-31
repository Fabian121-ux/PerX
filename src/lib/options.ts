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

export const opportunityTypeOptions = [
  { label: "Freelance project", value: "FREELANCE_PROJECT" },
  { label: "Job", value: "JOB" },
  { label: "Service", value: "SERVICE" },
  { label: "Product", value: "PRODUCT" },
  { label: "Real estate", value: "PROPERTY" },
  { label: "Partnership", value: "PARTNERSHIP" },
  { label: "Startup", value: "STARTUP" },
  { label: "Cofounder", value: "COFOUNDER" },
  { label: "Investment", value: "INVESTMENT" },
] as const;

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

export const opportunityCategoryOptions = [
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
    label: "Real estate",
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
