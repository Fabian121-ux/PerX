import { describe, expect, it } from "vitest";

import { opportunityFormSchema } from "@/lib/validation/opportunity";

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
});
