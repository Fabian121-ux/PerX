import { describe, expect, it } from "vitest";

import { opportunityFormSchema } from "@/lib/validation/opportunity";
import {
  creatableOpportunityTypeOptions,
  defaultOpportunityCategoryByType,
} from "@/lib/options";
import {
  isUnavailableInvestmentPublication,
  wouldPersistUnavailableInvestmentPublication,
} from "@/lib/opportunities/publication";

const validOpportunity = {
  title: "Verified property listing",
  summary: "A real property listing with required structured fields.",
  description:
    "This listing has enough detail for a user to understand the property and for PerX to evaluate the content before publication.",
  type: "PROPERTY",
  category: "real-estate",
  location: "Lagos",
  remote: false,
  currency: "NGN",
  intent: "draft",
};

describe("opportunity controlled values", () => {
  it("accepts approved real-estate fixed values", () => {
    const result = opportunityFormSchema.safeParse({
      ...validOpportunity,
      propertyType: "APARTMENT",
      propertyListingType: "RENT",
      contactPreference: "PERX_MESSAGES",
      authorityDeclaration:
        "I confirm I own this property or have authority to list it on PerX.",
      listingRulesAccepted: true,
    });

    expect(result.success).toBe(true);
  });

  it("rejects arbitrary property statuses and contact preferences", () => {
    const result = opportunityFormSchema.safeParse({
      ...validOpportunity,
      propertyType: "ANYTHING_GOES",
      propertyListingType: "SELL_FAST",
      contactPreference: "TEXT_ME_DIRECTLY",
    });

    expect(result.success).toBe(false);
  });

  it("normalizes empty property-only controls for non-property posts", () => {
    const result = opportunityFormSchema.safeParse({
      ...validOpportunity,
      category: "services",
      contactPreference: "",
      propertyListingType: "",
      propertyType: "",
      type: "SERVICE",
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.contactPreference).toBeUndefined();
    expect(result.data.propertyListingType).toBeUndefined();
    expect(result.data.propertyType).toBeUndefined();
  });

  it("keeps investment publishing unavailable and maps active type defaults", () => {
    expect(
      creatableOpportunityTypeOptions.some(
        (option) => option.value === ("INVESTMENT" as string),
      ),
    ).toBe(false);
    expect(defaultOpportunityCategoryByType.SERVICE).toBe("services");
    expect(defaultOpportunityCategoryByType.PRODUCT).toBe("market");
    expect(defaultOpportunityCategoryByType.PROPERTY).toBe("real-estate");
  });

  it("embargoes investment and co-investment publication from persisted state", () => {
    expect(
      isUnavailableInvestmentPublication({
        propertyListingType: "CO_INVESTMENT",
        type: "PROPERTY",
      }),
    ).toBe(true);
    expect(
      wouldPersistUnavailableInvestmentPublication({
        currentStatus: "PUBLISHED",
        intent: "draft",
        type: "INVESTMENT",
      }),
    ).toBe(true);
    expect(
      wouldPersistUnavailableInvestmentPublication({
        currentStatus: "DRAFT",
        intent: "draft",
        propertyListingType: "CO_INVESTMENT",
        type: "PROPERTY",
      }),
    ).toBe(false);
  });
});
