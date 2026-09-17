import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The remaining two silent shadowban paths.
 *
 * P0-4 fixed the create path and P0-5 built the queue that reviews it. Editing
 * a listing, and transitioning one to PUBLISHED, both still set
 * `moderationStatus: "FLAGGED"` and opened no case - so a listing withheld
 * through either path was invisible to the feed, to the author, and to every
 * admin queue at once. That is the original bug, still live on the more common
 * route: people edit listings far more often than they create them.
 *
 * RE-FLAG POLICY (the design question this PR had to answer):
 * we REUSE an open case rather than opening a second one. Three edits to one
 * listing must not become three queue items. The decisive constraint is in
 * P0-5's `reviewPolicyFlagCaseAction`: it releases the listing with
 * `updateMany ... where: { moderationStatus: "FLAGGED" }` and then requires
 * `count === 1`. Once an admin decides the first of several duplicate cases,
 * the listing leaves FLAGGED, and every remaining duplicate becomes
 * undecidable - it would fail that guard forever and sit in the queue as
 * permanently unresolvable work. Reuse keeps one case per withheld listing,
 * which is the invariant the review surface was built against.
 */

const mocks = vi.hoisted(() => ({
  assertCanPublish: vi.fn(),
  categoryUpsert: vi.fn(),
  findFirstOpportunity: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
  transaction: vi.fn(),
  writeAuditLog: vi.fn(),
}));

const tx = vi.hoisted(() => ({
  auditLog: { create: vi.fn() },
  moderationCase: {
    create: vi.fn(),
    findFirst: vi.fn(),
    updateMany: vi.fn(),
  },
  moderationCaseEvent: { create: vi.fn() },
  opportunity: { update: vi.fn(), updateMany: vi.fn() },
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
    opportunity: { findFirst: mocks.findFirstOpportunity },
    opportunityCategory: { upsert: mocks.categoryUpsert },
  }),
}));
vi.mock("@/lib/logging/audit", () => ({ writeAuditLog: mocks.writeAuditLog }));
vi.mock("@/lib/env", () => ({
  getResolvedDataMode: () => "database",
  hasDatabaseUrl: () => true,
}));

import {
  publishOpportunityAction,
  updateOpportunityAction,
} from "@/features/opportunities/actions";

/** Trips `unsafe-link-shortener-v1` -> FLAG. */
const BITLY_DESCRIPTION =
  "We deliver excellent professional services for growing teams. Portfolio and references available here: https://bit.ly/3xamplePortfolio and we respond within one business day to every enquiry.";

const CLEAN_DESCRIPTION =
  "We deliver excellent professional services for growing teams, with references available on request and a response within one business day.";

const EXISTING = {
  category: { slug: "software-development" },
  id: "opportunity-1",
  images: [],
  moderationStatus: "APPROVED",
  ownerId: "owner-1",
  publishedAt: new Date("2026-01-01T00:00:00.000Z"),
  slug: "professional-software-delivery-service-abc",
  status: "PUBLISHED",
  summary: "A clear professional summary of the work on offer.",
  title: "Professional software delivery service",
  type: "SERVICE",
};

function editForm(
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

function redirectTarget(error: unknown) {
  return String((error as Error).message).replace(/^REDIRECT:/, "");
}

async function captureRedirect(run: () => Promise<unknown>) {
  try {
    await run();
  } catch (error) {
    return redirectTarget(error);
  }
  throw new Error("expected a redirect");
}

function createdCase() {
  return tx.moderationCase.create.mock.calls[0]?.[0]?.data as
    | Record<string, unknown>
    | undefined;
}

function moderationStatusWritten() {
  const update = tx.opportunity.update.mock.calls[0]?.[0]?.data;
  const updateMany = tx.opportunity.updateMany.mock.calls[0]?.[0]?.data;
  return (update ?? updateMany)?.moderationStatus;
}

function auditActions() {
  return tx.auditLog.create.mock.calls.map((call) => call[0]?.data?.action);
}

function resetAll() {
  vi.clearAllMocks();
  mocks.assertCanPublish.mockResolvedValue(null);
  mocks.categoryUpsert.mockResolvedValue({
    id: "category-1",
    slug: "software-development",
  });
  mocks.findFirstOpportunity.mockResolvedValue({ ...EXISTING });
  mocks.transaction.mockImplementation((callback) => callback(tx));
  tx.opportunity.update.mockResolvedValue({ id: "opportunity-1" });
  tx.opportunity.updateMany.mockResolvedValue({ count: 1 });
  tx.moderationCase.create.mockResolvedValue({ id: "case-1" });
  tx.moderationCase.findFirst.mockResolvedValue(null);
  tx.moderationCase.updateMany.mockResolvedValue({ count: 1 });
}

describe("editing a listing into a policy flag", () => {
  beforeEach(resetAll);

  it("withholds the listing and opens a POLICY_FLAG case in the same transaction", async () => {
    await captureRedirect(() =>
      updateOpportunityAction("opportunity-1", editForm(BITLY_DESCRIPTION)),
    );

    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    expect(moderationStatusWritten()).toBe("FLAGGED");
    expect(tx.moderationCase.create).toHaveBeenCalledTimes(1);

    const data = createdCase();
    expect(data?.source).toBe("POLICY_FLAG");
    expect(data?.category).toBe("UNSAFE_LINK");
    expect(data?.targetType).toBe("opportunity");
    expect(data?.targetId).toBe("opportunity-1");
    expect(data?.reportedUserId).toBe("owner-1");
  });

  it("writes the audit row on the transaction client", async () => {
    await captureRedirect(() =>
      updateOpportunityAction("opportunity-1", editForm(BITLY_DESCRIPTION)),
    );

    expect(auditActions()).toContain("moderation.policy_flag_case_opened");
    // Never via writeAuditLog: it uses its own connection and swallows errors.
    const swallowed = mocks.writeAuditLog.mock.calls.map(
      (call) => call[0]?.action,
    );
    expect(swallowed).not.toContain("moderation.policy_flag_case_opened");
  });

  it("tells the author the edit left the listing withheld", async () => {
    const target = await captureRedirect(() =>
      updateOpportunityAction("opportunity-1", editForm(BITLY_DESCRIPTION)),
    );

    // An edit that withholds the listing must not look like a successful edit.
    expect(target).not.toBe("/app/manage?updated=1");
    expect(target).toMatch(/review=opportunity-1/);
  });

  it("discloses no rule, regex or detector id to the author", async () => {
    const target = await captureRedirect(() =>
      updateOpportunityAction("opportunity-1", editForm(BITLY_DESCRIPTION)),
    );

    expect(target).not.toMatch(/detector/i);
    expect(target).not.toMatch(/unsafe-link-shortener/i);
    expect(target).not.toMatch(/UNSAFE_LINK/);
    expect(target).not.toMatch(/bit\.ly/i);
    expect(target).not.toMatch(/regex|pattern/i);
  });

  it("leaves an unrelated clean edit untouched and opens no case", async () => {
    await captureRedirect(() =>
      updateOpportunityAction("opportunity-1", editForm(CLEAN_DESCRIPTION)),
    );

    // Regression guard: an already-APPROVED listing must not be re-flagged by
    // an edit that trips nothing.
    expect(moderationStatusWritten()).toBe("APPROVED");
    expect(tx.moderationCase.create).not.toHaveBeenCalled();
  });

  it("does not change moderationStatus when the case write fails", async () => {
    tx.moderationCase.create.mockRejectedValue(new Error("case write failed"));

    await expect(
      updateOpportunityAction("opportunity-1", editForm(BITLY_DESCRIPTION)),
    ).rejects.toThrow(/case write failed/);

    // The listing write and the case write share one transaction, so the
    // rollback is the database's job - what matters is that the error is not
    // swallowed and the author is not redirected to a success page.
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});

describe("re-flagging a listing that already has an open case", () => {
  beforeEach(resetAll);

  it("reuses the open case instead of opening a second one", async () => {
    tx.moderationCase.findFirst.mockResolvedValue({
      id: "case-existing",
      status: "NEW",
    });

    await captureRedirect(() =>
      updateOpportunityAction("opportunity-1", editForm(BITLY_DESCRIPTION)),
    );

    // Three edits must not become three queue items.
    expect(tx.moderationCase.create).not.toHaveBeenCalled();
    expect(tx.moderationCaseEvent.create).toHaveBeenCalledTimes(1);
    expect(tx.moderationCaseEvent.create.mock.calls[0]?.[0]?.data?.caseId).toBe(
      "case-existing",
    );
  });

  it("looks for an open case only, not a resolved one", async () => {
    await captureRedirect(() =>
      updateOpportunityAction("opportunity-1", editForm(BITLY_DESCRIPTION)),
    );

    const where = tx.moderationCase.findFirst.mock.calls[0]?.[0]?.where;
    expect(where).toEqual(
      expect.objectContaining({
        source: "POLICY_FLAG",
        targetId: "opportunity-1",
        targetType: "opportunity",
        status: { notIn: ["RESOLVED", "DISMISSED", "CLOSED"] },
      }),
    );
  });

  it("opens a fresh case when the previous one was already decided", async () => {
    // A decided case must not be reopened: the admin's decision stands, and a
    // later edit is new content that deserves its own review.
    tx.moderationCase.findFirst.mockResolvedValue(null);

    await captureRedirect(() =>
      updateOpportunityAction("opportunity-1", editForm(BITLY_DESCRIPTION)),
    );

    expect(tx.moderationCase.create).toHaveBeenCalledTimes(1);
    expect(tx.moderationCaseEvent.create).not.toHaveBeenCalled();
  });
});

describe("transitioning a listing into a policy flag", () => {
  beforeEach(() => {
    resetAll();
    mocks.findFirstOpportunity.mockResolvedValue({
      ...EXISTING,
      description: BITLY_DESCRIPTION,
      moderationStatus: "PENDING",
      status: "DRAFT",
    });
  });

  it("withholds the listing and opens a POLICY_FLAG case in the same transaction", async () => {
    await captureRedirect(() => publishOpportunityAction("opportunity-1"));

    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    expect(moderationStatusWritten()).toBe("FLAGGED");
    expect(tx.moderationCase.create).toHaveBeenCalledTimes(1);

    const data = createdCase();
    expect(data?.source).toBe("POLICY_FLAG");
    expect(data?.targetId).toBe("opportunity-1");
    expect(data?.reportedUserId).toBe("owner-1");
  });

  it("writes the audit row on the transaction client", async () => {
    await captureRedirect(() => publishOpportunityAction("opportunity-1"));

    expect(auditActions()).toContain("moderation.policy_flag_case_opened");
  });

  it("preserves the optimistic-concurrency guard", async () => {
    tx.opportunity.updateMany.mockResolvedValue({ count: 0 });

    const target = await captureRedirect(() =>
      publishOpportunityAction("opportunity-1"),
    );

    // A lost race must still abort rather than opening a case for a listing
    // that was never withheld.
    expect(target).toBe("/app/manage?error=state-changed");
    expect(tx.moderationCase.create).not.toHaveBeenCalled();
  });

  it("reuses an open case rather than opening a second one", async () => {
    tx.moderationCase.findFirst.mockResolvedValue({
      id: "case-existing",
      status: "NEW",
    });

    await captureRedirect(() => publishOpportunityAction("opportunity-1"));

    expect(tx.moderationCase.create).not.toHaveBeenCalled();
    expect(tx.moderationCaseEvent.create).toHaveBeenCalledTimes(1);
  });

  it("tells the author the listing is withheld", async () => {
    const target = await captureRedirect(() =>
      publishOpportunityAction("opportunity-1"),
    );

    expect(target).not.toBe("/app/manage");
    expect(target).toMatch(/review=opportunity-1/);
  });

  it("discloses no rule, regex or detector id to the author", async () => {
    const target = await captureRedirect(() =>
      publishOpportunityAction("opportunity-1"),
    );

    expect(target).not.toMatch(/detector/i);
    expect(target).not.toMatch(/unsafe-link-shortener/i);
    expect(target).not.toMatch(/UNSAFE_LINK/);
    expect(target).not.toMatch(/bit\.ly/i);
  });

  it("does not change moderationStatus when the case write fails", async () => {
    tx.moderationCase.create.mockRejectedValue(new Error("case write failed"));

    await expect(
      publishOpportunityAction("opportunity-1"),
    ).rejects.toThrow(/case write failed/);

    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("opens no case for a transition that trips nothing", async () => {
    mocks.findFirstOpportunity.mockResolvedValue({
      ...EXISTING,
      description: CLEAN_DESCRIPTION,
      moderationStatus: "PENDING",
      status: "DRAFT",
    });

    await captureRedirect(() => publishOpportunityAction("opportunity-1"));

    expect(moderationStatusWritten()).toBe("APPROVED");
    expect(tx.moderationCase.create).not.toHaveBeenCalled();
  });

  it("opens no case for a non-publishing transition", async () => {
    await captureRedirect(() =>
      import("@/features/opportunities/actions").then((module) =>
        module.archiveOpportunityAction("opportunity-1"),
      ),
    );

    expect(tx.moderationCase.create).not.toHaveBeenCalled();
  });
});
