import type { OpportunityType } from "@/generated/prisma/enums";

export function isUnavailableInvestmentPublication({
  propertyListingType,
  type,
}: {
  propertyListingType?: string | null;
  type: OpportunityType;
}) {
  return (
    type === "INVESTMENT" ||
    propertyListingType === "CO_INVESTMENT"
  );
}

export function wouldPersistUnavailableInvestmentPublication({
  currentStatus,
  intent,
  ...opportunity
}: {
  currentStatus: string;
  intent: "draft" | "publish";
  propertyListingType?: string | null;
  type: OpportunityType;
}) {
  return (
    (intent === "publish" || currentStatus === "PUBLISHED") &&
    isUnavailableInvestmentPublication(opportunity)
  );
}
