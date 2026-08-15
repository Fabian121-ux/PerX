// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearOpportunityComposerDraft,
  getOpportunityComposerDraftKey,
  readOpportunityComposerDraft,
  writeOpportunityComposerDraft,
  type OpportunityComposerDraftFields,
} from "@/lib/opportunities/composer-draft";

const fields: OpportunityComposerDraftFields = {
  budgetMax: "1200.00",
  budgetMin: "500",
  category: "services",
  contactPreference: "",
  currency: "NGN",
  description: "Partially entered details",
  listingRulesAccepted: false,
  location: "Lagos",
  propertyListingType: "",
  propertyType: "",
  remote: true,
  skills: "Design",
  summary: "Partial summary",
  title: "Partial title",
};

describe("opportunity composer browser drafts", () => {
  beforeEach(() => window.localStorage.clear());

  it("scopes keys to authenticated user and creatable type", () => {
    expect(getOpportunityComposerDraftKey("user-1", "SERVICE")).not.toBe(
      getOpportunityComposerDraftKey("user-2", "SERVICE"),
    );
    expect(getOpportunityComposerDraftKey("user-1", "SERVICE")).not.toBe(
      getOpportunityComposerDraftKey("user-1", "PRODUCT"),
    );
    expect(getOpportunityComposerDraftKey("user-1", "INVESTMENT")).toBeNull();
  });

  it("round-trips allowlisted fields and never serializes authority or intent", () => {
    expect(writeOpportunityComposerDraft("user-1", "SERVICE", fields, 1000)).toBe(
      true,
    );
    expect(readOpportunityComposerDraft("user-1", "SERVICE", 1001)).toEqual({
      fields,
      savedAt: 1000,
      type: "SERVICE",
      version: 1,
    });
    const raw = window.localStorage.getItem(
      getOpportunityComposerDraftKey("user-1", "SERVICE")!,
    );
    expect(raw).not.toContain("authorityDeclaration");
    expect(raw).not.toContain("intent");
  });

  it("rejects stale, corrupt, oversized, and cross-type data", () => {
    const key = getOpportunityComposerDraftKey("user-1", "SERVICE")!;
    window.localStorage.setItem(key, "not-json");
    expect(readOpportunityComposerDraft("user-1", "SERVICE")).toBeNull();
    expect(window.localStorage.getItem(key)).toBeNull();

    writeOpportunityComposerDraft("user-1", "SERVICE", fields, 1);
    expect(readOpportunityComposerDraft("user-1", "SERVICE", 3_000_000_000)).toBeNull();

    window.localStorage.setItem(
      key,
      JSON.stringify({ fields, savedAt: Date.now(), type: "PRODUCT", version: 1 }),
    );
    expect(readOpportunityComposerDraft("user-1", "SERVICE")).toBeNull();

    window.localStorage.setItem(key, "x".repeat(16_001));
    expect(readOpportunityComposerDraft("user-1", "SERVICE")).toBeNull();
  });

  it("handles storage failures and clears only the exact key", () => {
    writeOpportunityComposerDraft("user-1", "SERVICE", fields);
    writeOpportunityComposerDraft("user-1", "PRODUCT", {
      ...fields,
      category: "market",
    });
    clearOpportunityComposerDraft("user-1", "SERVICE");
    expect(readOpportunityComposerDraft("user-1", "SERVICE")).toBeNull();
    expect(readOpportunityComposerDraft("user-1", "PRODUCT")).not.toBeNull();

    const setItem = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("quota");
      });
    expect(writeOpportunityComposerDraft("user-2", "SERVICE", fields)).toBe(
      false,
    );
    setItem.mockRestore();
  });
});
