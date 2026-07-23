export const opportunityTypeValues = [
  "FREELANCE_PROJECT",
  "JOB",
  "SERVICE",
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

export const reportReasonValues = [
  "SPAM",
  "SCAM_OR_FRAUD",
  "HARASSMENT",
  "PROHIBITED_CONTENT",
  "MISLEADING_CLAIMS",
  "UNSAFE_PAYMENT",
] as const;

export const reportReasonOptions = [
  { label: "Spam or repetitive posting", value: "SPAM" },
  { label: "Scam or fraud concern", value: "SCAM_OR_FRAUD" },
  { label: "Harassment or abuse", value: "HARASSMENT" },
  { label: "Prohibited goods or services", value: "PROHIBITED_CONTENT" },
  { label: "Misleading claims", value: "MISLEADING_CLAIMS" },
  { label: "Unsafe payment request", value: "UNSAFE_PAYMENT" },
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
