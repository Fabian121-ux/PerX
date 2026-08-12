import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findListing: vi.fn(),
  requireCapabilityOrNotFound: vi.fn(),
  transaction: vi.fn(),
}));
const tx = vi.hoisted(() => ({
  auditLog: { create: vi.fn() },
  moderationAction: { create: vi.fn() },
  notification: { create: vi.fn() },
  opportunity: { updateMany: vi.fn() },
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({
  requireCapabilityOrNotFound: mocks.requireCapabilityOrNotFound,
}));
vi.mock("@/lib/db/prisma", () => ({
  getPrisma: () => ({
    $transaction: mocks.transaction,
    opportunity: { findFirst: mocks.findListing },
  }),
}));
vi.mock("@/lib/logging/audit", () => ({ writeAuditLog: vi.fn() }));
vi.mock("@/lib/notifications/action-url", () => ({
  normalizeNotificationActionUrl: vi.fn(),
}));
vi.mock("@/lib/network/pair-lock", () => ({ lockUserAccount: vi.fn() }));

import { reviewPropertyListingAction } from "@/features/admin/actions";

describe("admin property listing review", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireCapabilityOrNotFound.mockResolvedValue({ id: "admin-1" });
    mocks.transaction.mockImplementation((callback) => callback(tx));
    tx.opportunity.updateMany.mockResolvedValue({ count: 1 });
  });

  it("cannot approve a co-investment listing for publication", async () => {
    mocks.findListing.mockResolvedValue({
      authorityDeclaration: "I am authorized to publish this listing.",
      contactPreference: "PERX_MESSAGES",
      images: [{ isCover: true }],
      listingRulesAccepted: true,
      owner: { id: "owner-1" },
      propertyListingType: "CO_INVESTMENT",
      propertyType: "APARTMENT",
      type: "PROPERTY",
    });
    const formData = new FormData();
    formData.set("decision", "approve");
    formData.set("opportunityId", "opportunity-1");
    formData.set("reason", "Regulated listing review.");

    await expect(reviewPropertyListingAction(formData)).rejects.toThrow(
      "Co-investment listings are not available for publication.",
    );
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("does not approve when publication eligibility changes before the write", async () => {
    mocks.findListing.mockResolvedValue({
      authorityDeclaration: "I am authorized to publish this listing.",
      contactPreference: "PERX_MESSAGES",
      images: [{ isCover: true }],
      listingRulesAccepted: true,
      moderationStatus: "PENDING",
      owner: { id: "owner-1" },
      propertyListingType: "SALE",
      propertyType: "APARTMENT",
      publishedAt: null,
      status: "DRAFT",
      type: "PROPERTY",
    });
    tx.opportunity.updateMany.mockResolvedValue({ count: 0 });
    const formData = new FormData();
    formData.set("decision", "approve");
    formData.set("opportunityId", "opportunity-1");
    formData.set("reason", "Reviewed listing requirements.");

    await expect(reviewPropertyListingAction(formData)).rejects.toThrow(
      "Listing changed during review. Review it again.",
    );
    expect(tx.moderationAction.create).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
    expect(tx.notification.create).not.toHaveBeenCalled();
  });
});
