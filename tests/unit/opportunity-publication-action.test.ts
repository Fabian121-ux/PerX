import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  assertCanPublish: vi.fn(),
  findOpportunity: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
  transaction: vi.fn(),
}));
const tx = vi.hoisted(() => ({
  auditLog: { create: vi.fn() },
  opportunity: { updateMany: vi.fn() },
  opportunityStatusHistory: { create: vi.fn() },
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/account/enforcement", () => ({
  assertCanPublish: mocks.assertCanPublish,
}));
vi.mock("@/lib/auth/session", () => ({
  requireUser: vi.fn(async () => ({
    id: "owner-1",
    roles: ["CLIENT"],
    username: "owner-one",
  })),
}));
vi.mock("@/lib/db/prisma", () => ({
  getPrisma: () => ({
    $transaction: mocks.transaction,
    opportunity: { findFirst: mocks.findOpportunity },
  }),
}));
vi.mock("@/lib/logging/audit", () => ({ writeAuditLog: vi.fn() }));

import { publishOpportunityAction } from "@/features/opportunities/actions";

describe("opportunity publication action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.assertCanPublish.mockResolvedValue(null);
    mocks.findOpportunity.mockResolvedValue({
      category: { slug: "services" },
      description: "A detailed service description that passes policy checks.",
      id: "opportunity-1",
      images: [],
      moderationStatus: "PENDING",
      ownerId: "owner-1",
      propertyListingType: null,
      publishedAt: null,
      slug: "safe-service",
      status: "DRAFT",
      summary: "A detailed service summary.",
      title: "Safe professional service",
      type: "SERVICE",
    });
    mocks.transaction.mockImplementation((callback) => callback(tx));
  });

  it("does not publish or write history when the atomic eligibility claim loses", async () => {
    tx.opportunity.updateMany.mockResolvedValue({ count: 0 });

    await expect(publishOpportunityAction("opportunity-1")).rejects.toThrow(
      "REDIRECT:/app/manage?error=state-changed",
    );

    expect(tx.opportunity.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "opportunity-1",
          ownerId: "owner-1",
          type: { not: "INVESTMENT" },
        }),
      }),
    );
    expect(tx.opportunityStatusHistory.create).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });
});
