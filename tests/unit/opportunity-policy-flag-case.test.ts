import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Silent shadowban regression cover.
 *
 * A listing that tripped a non-blocking policy rule (FLAG or LIMIT) was
 * created, the author was redirected to a success page, and the listing was
 * then invisible in every feed forever: the feed requires
 * `moderationStatus: "APPROVED"`, and nothing created a ModerationCase for a
 * policy flag. No signal to the author, no entry in any admin queue - nobody
 * in the system knew the listing existed.
 *
 * The rules are sound; the silence was the bug. These tests assert the two
 * halves of breaking that silence: a POLICY_FLAG case is always created
 * alongside a FLAGGED listing, atomically, and the author is told.
 */

const mocks = vi.hoisted(() => ({
  assertCanPublish: vi.fn(),
  categoryUpsert: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
  transaction: vi.fn(),
  writeAuditLog: vi.fn(),
}));

const tx = vi.hoisted(() => ({
  auditLog: { create: vi.fn() },
  moderationCase: { create: vi.fn() },
  opportunity: { create: vi.fn() },
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
    opportunityCategory: { upsert: mocks.categoryUpsert },
  }),
}));
vi.mock("@/lib/logging/audit", () => ({ writeAuditLog: mocks.writeAuditLog }));
vi.mock("@/lib/env", () => ({
  getResolvedDataMode: () => "database",
  hasDatabaseUrl: () => true,
}));

import { createOpportunityAction } from "@/features/opportunities/actions";

/** Trips `unsafe-link-shortener-v1` -> FLAG. */
const BITLY_DESCRIPTION =
  "We deliver excellent professional services for growing teams. Portfolio and references available here: https://bit.ly/3xamplePortfolio and we respond within one business day to every enquiry.";

/** Trips `repeated-promo-v1` -> LIMIT. */
const PROMO_DESCRIPTION =
  "This is a guaranteed result for your business and it is completely risk free, a guaranteed outcome you can rely on for your next professional engagement with our team.";

/** Trips `violent-threat-v1` -> BLOCK. */
const THREAT_DESCRIPTION =
  "If you do not pay me on time for this professional engagement then i will hurt you and your family, this is how we operate with every client.";

/** Trips `advance-payment-request-v1` -> ESCALATE. */
const ESCALATE_DESCRIPTION =
  "To begin this professional engagement please wire the full amount upfront to our account and we will schedule the work immediately for you.";

const CLEAN_DESCRIPTION =
  "We deliver excellent professional services for growing teams, with references available on request and a response within one business day.";

function opportunityForm(
  description: string,
  intent: "publish" | "draft" = "publish",
) {
  const formData = new FormData();
  formData.set("budgetMax", "");
  formData.set("budgetMin", "");
  formData.set("category", "software");
  formData.set("currency", "NGN");
  formData.set("description", description);
  formData.set("intent", intent);
  formData.set("location", "Lagos");
  formData.set("skills", "");
  formData.set("summary", "A clear professional summary of the work on offer.");
  formData.set("title", "Professional software delivery service");
  formData.set("type", "SERVICE");
  return formData;
}

function createdCase() {
  return tx.moderationCase.create.mock.calls[0]?.[0]?.data as
    | Record<string, unknown>
    | undefined;
}

describe("policy-flagged opportunity creates a moderation case", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.assertCanPublish.mockResolvedValue(null);
    mocks.categoryUpsert.mockResolvedValue({
      id: "category-1",
      slug: "software-development",
    });
    mocks.transaction.mockImplementation((callback) => callback(tx));
    tx.opportunity.create.mockResolvedValue({
      id: "opportunity-1",
      slug: "professional-software-delivery-service-abc",
    });
    tx.moderationCase.create.mockResolvedValue({ id: "case-1" });
  });

  it("creates a POLICY_FLAG case for a FLAG outcome, in the same transaction", async () => {
    await expect(
      createOpportunityAction({ status: "idle" }, opportunityForm(BITLY_DESCRIPTION)),
    ).rejects.toThrow(/^REDIRECT:/);

    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    expect(tx.opportunity.create).toHaveBeenCalledTimes(1);
    expect(tx.moderationCase.create).toHaveBeenCalledTimes(1);

    const data = createdCase();
    expect(data?.source).toBe("POLICY_FLAG");
    expect(data?.category).toBe("UNSAFE_LINK");
    expect(data?.targetType).toBe("opportunity");
    expect(data?.targetId).toBe("opportunity-1");
    expect(data?.reportedUserId).toBe("owner-1");
  });

  it("creates a POLICY_FLAG case for a LIMIT outcome", async () => {
    await expect(
      createOpportunityAction({ status: "idle" }, opportunityForm(PROMO_DESCRIPTION)),
    ).rejects.toThrow(/^REDIRECT:/);

    expect(tx.moderationCase.create).toHaveBeenCalledTimes(1);
    expect(createdCase()?.source).toBe("POLICY_FLAG");
    expect(createdCase()?.category).toBe("SPAM");
  });

  it("marks the flagged listing FLAGGED rather than APPROVED", async () => {
    await expect(
      createOpportunityAction({ status: "idle" }, opportunityForm(BITLY_DESCRIPTION)),
    ).rejects.toThrow(/^REDIRECT:/);

    expect(tx.opportunity.create.mock.calls[0]?.[0]?.data?.moderationStatus).toBe(
      "FLAGGED",
    );
  });

  it("states which rule matched, for admins, on the case", async () => {
    await expect(
      createOpportunityAction({ status: "idle" }, opportunityForm(BITLY_DESCRIPTION)),
    ).rejects.toThrow(/^REDIRECT:/);

    const data = createdCase();
    // Admins get the detail the author must never see.
    expect(String(data?.summary)).toMatch(/shortened URL/i);
    expect(String(data?.title)).toMatch(/policy/i);
  });

  it("records an audit entry for the case creation", async () => {
    await expect(
      createOpportunityAction({ status: "idle" }, opportunityForm(BITLY_DESCRIPTION)),
    ).rejects.toThrow(/^REDIRECT:/);

    const auditActions = tx.auditLog.create.mock.calls.map(
      (call) => call[0]?.data?.action,
    );
    expect(auditActions).toContain("moderation.policy_flag_case_opened");
  });

  it("does NOT create the opportunity if the case write fails", async () => {
    // The bug being fixed is a FLAGGED listing with no case. A half-succeeded
    // pair must roll back, so the real transaction semantics are simulated.
    tx.moderationCase.create.mockRejectedValue(new Error("case write failed"));
    mocks.transaction.mockImplementation(async (callback) => {
      // A real $transaction propagates the rejection and rolls back.
      return callback(tx);
    });

    await expect(
      createOpportunityAction({ status: "idle" }, opportunityForm(BITLY_DESCRIPTION)),
    ).rejects.toThrow(/case write failed/);

    // The redirect to a success page must never be reached.
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("creates no case and publishes normally for an ALLOW outcome", async () => {
    await expect(
      createOpportunityAction({ status: "idle" }, opportunityForm(CLEAN_DESCRIPTION)),
    ).rejects.toThrow(/^REDIRECT:/);

    expect(tx.moderationCase.create).not.toHaveBeenCalled();
    expect(tx.opportunity.create.mock.calls[0]?.[0]?.data?.moderationStatus).toBe(
      "APPROVED",
    );
  });

  it("creates no case for a draft, which is not published", async () => {
    await expect(
      createOpportunityAction(
        { status: "idle" },
        opportunityForm(BITLY_DESCRIPTION, "draft"),
      ),
    ).rejects.toThrow(/^REDIRECT:/);

    expect(tx.moderationCase.create).not.toHaveBeenCalled();
    expect(tx.opportunity.create.mock.calls[0]?.[0]?.data?.moderationStatus).toBe(
      "PENDING",
    );
  });

  it("still blocks a BLOCK outcome entirely, creating nothing", async () => {
    const result = await createOpportunityAction(
      { status: "idle" },
      opportunityForm(THREAT_DESCRIPTION),
    );

    expect(result.status).toBe("error");
    expect(tx.opportunity.create).not.toHaveBeenCalled();
    expect(tx.moderationCase.create).not.toHaveBeenCalled();
  });

  it("still blocks an ESCALATE outcome entirely, creating nothing", async () => {
    const result = await createOpportunityAction(
      { status: "idle" },
      opportunityForm(ESCALATE_DESCRIPTION),
    );

    expect(result.status).toBe("error");
    expect(tx.opportunity.create).not.toHaveBeenCalled();
    expect(tx.moderationCase.create).not.toHaveBeenCalled();
  });

  it("tells the author the listing is under review, not that it is live", async () => {
    await expect(
      createOpportunityAction({ status: "idle" }, opportunityForm(BITLY_DESCRIPTION)),
    ).rejects.toThrow(/^REDIRECT:/);

    const destination = mocks.redirect.mock.calls[0]?.[0] as string;
    expect(destination).toMatch(/review/i);
    // The old behaviour redirected to `?created=` - a plain success.
    expect(destination).not.toMatch(/created=/);
  });

  it("never leaks the rule, regex or detector id to the author", async () => {
    await expect(
      createOpportunityAction({ status: "idle" }, opportunityForm(BITLY_DESCRIPTION)),
    ).rejects.toThrow(/^REDIRECT:/);

    // A matched-rule name is a roadmap for evading moderation.
    const destination = String(mocks.redirect.mock.calls[0]?.[0]);
    expect(destination).not.toMatch(/unsafe-link-shortener/i);
    expect(destination).not.toMatch(/detector/i);
    expect(destination).not.toMatch(/bit\.ly/i);
    expect(destination).not.toMatch(/UNSAFE_LINK/);
    expect(destination).not.toMatch(/shortened/i);
  });

  it("sends a clean publish to the normal success destination", async () => {
    await expect(
      createOpportunityAction({ status: "idle" }, opportunityForm(CLEAN_DESCRIPTION)),
    ).rejects.toThrow(/^REDIRECT:/);

    expect(String(mocks.redirect.mock.calls[0]?.[0])).toContain("created=");
  });
});
