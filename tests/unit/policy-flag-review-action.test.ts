import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Closing the loop P0-4 opened.
 *
 * P0-4 stopped the silent shadowban: a policy-flagged listing now creates a
 * POLICY_FLAG case and the author is told it is "under review". But nothing
 * could perform that review, so the listing stayed withheld permanently and the
 * author waited on something that could never happen.
 *
 * The invariant these tests defend is the one P0-4 established: the listing and
 * its case move together. A cleared listing with an open case, or a closed case
 * over a still-withheld listing, is the same class of inconsistency.
 */

const mocks = vi.hoisted(() => ({
  findCase: vi.fn(),
  requireCapabilityOrNotFound: vi.fn(),
  transaction: vi.fn(),
}));

const tx = vi.hoisted(() => ({
  auditLog: { create: vi.fn() },
  moderationAction: { create: vi.fn() },
  moderationCase: { updateMany: vi.fn() },
  moderationCaseEvent: { create: vi.fn() },
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
    moderationCase: { findUnique: mocks.findCase },
  }),
}));

import { reviewPolicyFlagCaseAction } from "@/features/admin/actions";

const CASE_ID = "case-1";
const OPPORTUNITY_ID = "opportunity-1";
const OWNER_ID = "owner-1";

function decisionForm(decision: string, reason = "Reviewed and decided.") {
  const formData = new FormData();
  formData.set("caseId", CASE_ID);
  formData.set("decision", decision);
  formData.set("reason", reason);
  return formData;
}

function auditActions() {
  return tx.auditLog.create.mock.calls.map((call) => call[0]?.data?.action);
}

function notificationBody() {
  return String(tx.notification.create.mock.calls[0]?.[0]?.data?.body ?? "");
}

describe("policy flag case review action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireCapabilityOrNotFound.mockResolvedValue({ id: "admin-1" });
    mocks.findCase.mockResolvedValue({
      id: CASE_ID,
      source: "POLICY_FLAG",
      status: "NEW",
      targetId: OPPORTUNITY_ID,
      targetType: "opportunity",
      reportedUserId: OWNER_ID,
    });
    mocks.transaction.mockImplementation((callback) => callback(tx));
    tx.opportunity.updateMany.mockResolvedValue({ count: 1 });
    tx.moderationCase.updateMany.mockResolvedValue({ count: 1 });
  });

  it("clears the listing to APPROVED and closes the case in one transaction", async () => {
    await reviewPolicyFlagCaseAction(decisionForm("clear"));

    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    expect(tx.opportunity.updateMany).toHaveBeenCalledTimes(1);
    expect(tx.moderationCase.updateMany).toHaveBeenCalledTimes(1);

    const listingWrite = tx.opportunity.updateMany.mock.calls[0]?.[0];
    expect(listingWrite?.data?.moderationStatus).toBe("APPROVED");
    expect(tx.moderationCase.updateMany.mock.calls[0]?.[0]?.data?.status).toBe(
      "RESOLVED",
    );
  });

  it("upholds the flag by leaving the listing withheld and resolving the case", async () => {
    await reviewPolicyFlagCaseAction(decisionForm("uphold"));

    // The listing must NOT become APPROVED.
    const listingWrite = tx.opportunity.updateMany.mock.calls[0]?.[0];
    expect(listingWrite?.data?.moderationStatus).not.toBe("APPROVED");
    expect(listingWrite?.data?.moderationStatus).toBe("REJECTED");
    expect(tx.moderationCase.updateMany.mock.calls[0]?.[0]?.data?.status).toBe(
      "RESOLVED",
    );
  });

  it("uses optimistic concurrency on the case so two admins cannot both win", async () => {
    await reviewPolicyFlagCaseAction(decisionForm("clear"));

    // The expected status must be part of the WHERE, not just read earlier.
    expect(tx.moderationCase.updateMany.mock.calls[0]?.[0]?.where).toEqual(
      expect.objectContaining({ id: CASE_ID, status: "NEW" }),
    );
  });

  it("only releases a listing that is still FLAGGED", async () => {
    await reviewPolicyFlagCaseAction(decisionForm("clear"));

    /*
     * Without this precondition the action would overwrite whatever state the
     * listing reached in the meantime - re-publishing something the owner
     * archived, or clobbering another admin's REJECTED decision.
     */
    expect(tx.opportunity.updateMany.mock.calls[0]?.[0]?.where).toEqual(
      expect.objectContaining({
        id: OPPORTUNITY_ID,
        moderationStatus: "FLAGGED",
      }),
    );
  });

  it("rejects a second decision on an already-decided case", async () => {
    tx.moderationCase.updateMany.mockResolvedValue({ count: 0 });

    await expect(reviewPolicyFlagCaseAction(decisionForm("clear"))).rejects.toThrow(
      /changed during review|already/i,
    );
  });

  it("does not change the listing when the case write fails", async () => {
    tx.moderationCase.updateMany.mockRejectedValue(new Error("case write failed"));

    await expect(
      reviewPolicyFlagCaseAction(decisionForm("clear")),
    ).rejects.toThrow(/case write failed/);

    // The transaction rolls back; no notification may be promised either.
    expect(tx.notification.create).not.toHaveBeenCalled();
  });

  it("does not close the case when the listing write fails", async () => {
    tx.opportunity.updateMany.mockRejectedValue(new Error("listing write failed"));

    await expect(
      reviewPolicyFlagCaseAction(decisionForm("clear")),
    ).rejects.toThrow(/listing write failed/);

    expect(tx.moderationCase.updateMany).not.toHaveBeenCalled();
    expect(tx.notification.create).not.toHaveBeenCalled();
  });

  it("aborts when the listing row does not match the expected withheld state", async () => {
    tx.opportunity.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      reviewPolicyFlagCaseAction(decisionForm("clear")),
    ).rejects.toThrow(/changed during review|already/i);

    expect(tx.notification.create).not.toHaveBeenCalled();
  });

  it("writes an audit row inside the transaction for a clear", async () => {
    await reviewPolicyFlagCaseAction(decisionForm("clear"));

    expect(auditActions()).toContain("admin.policy_flag.reviewed");
    const metadata = tx.auditLog.create.mock.calls[0]?.[0]?.data?.metadata;
    expect(metadata?.decision).toBe("clear");
  });

  it("writes an audit row inside the transaction for an uphold", async () => {
    await reviewPolicyFlagCaseAction(decisionForm("uphold"));

    expect(auditActions()).toContain("admin.policy_flag.reviewed");
    expect(tx.auditLog.create.mock.calls[0]?.[0]?.data?.metadata?.decision).toBe(
      "uphold",
    );
  });

  it("notifies the author that a cleared listing is live", async () => {
    await reviewPolicyFlagCaseAction(decisionForm("clear"));

    const data = tx.notification.create.mock.calls[0]?.[0]?.data;
    expect(data?.userId).toBe(OWNER_ID);
    expect(data?.type).toBe("MODERATION_UPDATE");
    expect(notificationBody()).toMatch(/live|visible|published|approved/i);
  });

  it("notifies the author that an upheld listing stays withheld, with a way forward", async () => {
    await reviewPolicyFlagCaseAction(decisionForm("uphold"));

    const body = notificationBody();
    expect(body).toMatch(/not|cannot|withheld|remains/i);
    // They were promised a review; they must be told what they can do next.
    expect(body).toMatch(/edit|update|support|appeal|change/i);
  });

  it("never discloses the rule, regex or detector id to the author", async () => {
    for (const decision of ["clear", "uphold"]) {
      vi.clearAllMocks();
      mocks.requireCapabilityOrNotFound.mockResolvedValue({ id: "admin-1" });
      mocks.findCase.mockResolvedValue({
        id: CASE_ID,
        source: "POLICY_FLAG",
        status: "NEW",
        targetId: OPPORTUNITY_ID,
        targetType: "opportunity",
        reportedUserId: OWNER_ID,
      });
      mocks.transaction.mockImplementation((callback) => callback(tx));
      tx.opportunity.updateMany.mockResolvedValue({ count: 1 });
      tx.moderationCase.updateMany.mockResolvedValue({ count: 1 });

      await reviewPolicyFlagCaseAction(decisionForm(decision));

      const serialized = JSON.stringify(tx.notification.create.mock.calls);
      expect(serialized).not.toMatch(/detector/i);
      expect(serialized).not.toMatch(/unsafe-link-shortener/i);
      expect(serialized).not.toMatch(/UNSAFE_LINK/);
      expect(serialized).not.toMatch(/bit\.ly/i);
      expect(serialized).not.toMatch(/regex|pattern/i);
    }
  });

  it("requires admin:moderate", async () => {
    await reviewPolicyFlagCaseAction(decisionForm("clear"));

    expect(mocks.requireCapabilityOrNotFound).toHaveBeenCalledWith(
      "admin:moderate",
    );
  });

  it("propagates notFound when the capability is missing", async () => {
    const { notFound } = await import("next/navigation");
    mocks.requireCapabilityOrNotFound.mockImplementation(async () => {
      notFound();
    });

    await expect(
      reviewPolicyFlagCaseAction(decisionForm("clear")),
    ).rejects.toMatchObject({ digest: "NEXT_HTTP_ERROR_FALLBACK;404" });

    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("refuses to act on a case that is not a policy flag", async () => {
    mocks.findCase.mockResolvedValue({
      id: CASE_ID,
      source: "USER_REPORT",
      status: "NEW",
      targetId: OPPORTUNITY_ID,
      targetType: "opportunity",
      reportedUserId: OWNER_ID,
    });

    await expect(
      reviewPolicyFlagCaseAction(decisionForm("clear")),
    ).rejects.toThrow();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("requires a decision and a reason", async () => {
    await expect(reviewPolicyFlagCaseAction(decisionForm("clear", "short"))).rejects.toThrow();
    await expect(reviewPolicyFlagCaseAction(decisionForm("banana"))).rejects.toThrow();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
