// @vitest-environment jsdom

import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { OpportunityDraftCleanup } from "@/components/opportunities/opportunity-draft-cleanup";
import {
  getOpportunityComposerDraftKey,
  writeOpportunityComposerDraft,
  type OpportunityComposerDraftFields,
} from "@/lib/opportunities/composer-draft";

const fields: OpportunityComposerDraftFields = {
  budgetMax: "",
  budgetMin: "",
  category: "services",
  contactPreference: "",
  currency: "NGN",
  description: "",
  listingRulesAccepted: false,
  location: "",
  propertyListingType: "",
  propertyType: "",
  remote: true,
  skills: "",
  summary: "",
  title: "Saved locally",
};

describe("opportunity draft success cleanup", () => {
  beforeEach(() => window.localStorage.clear());

  it("removes only the confirmed user and type key", async () => {
    writeOpportunityComposerDraft("user-1", "SERVICE", fields);
    writeOpportunityComposerDraft("user-1", "PRODUCT", {
      ...fields,
      category: "market",
    });
    writeOpportunityComposerDraft("user-2", "SERVICE", fields);

    render(<OpportunityDraftCleanup type="SERVICE" userId="user-1" />);
    await waitFor(() =>
      expect(
        window.localStorage.getItem(
          getOpportunityComposerDraftKey("user-1", "SERVICE")!,
        ),
      ).toBeNull(),
    );
    expect(
      window.localStorage.getItem(
        getOpportunityComposerDraftKey("user-1", "PRODUCT")!,
      ),
    ).not.toBeNull();
    expect(
      window.localStorage.getItem(
        getOpportunityComposerDraftKey("user-2", "SERVICE")!,
      ),
    ).not.toBeNull();
  });
});
