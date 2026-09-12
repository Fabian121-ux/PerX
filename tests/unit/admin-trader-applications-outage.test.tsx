import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Regression cover for the 15-day admin portal outage.
 *
 * A merged-but-unapplied migration left `TraderApplication` absent in
 * production. The page awaited `findMany` bare, so a single missing relation
 * escaped the page, hit the only boundary in the /admin subtree, and took the
 * whole portal down - nav included - behind an opaque digest.
 *
 * These assert the two properties that were missing: the failure stays inside
 * the page as a degraded state, and nothing derived from the error text is
 * logged. The authorization tests matter just as much: the guard must still run
 * first, and its control-flow throw must NOT be caught by the new try/catch.
 */

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  requireCapabilityOrNotFound: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  requireCapabilityOrNotFound: mocks.requireCapabilityOrNotFound,
}));

vi.mock("@/lib/db/prisma", () => ({
  getPrisma: () => ({
    traderApplication: { findMany: mocks.findMany },
  }),
}));

// `TraderDecisionControls` is a "use client" component. In a real RSC render
// Next emits a client reference and never runs its hooks on the server; vitest
// has no such boundary, so it is stubbed to keep these tests about the page's
// own failure handling rather than the control's provider requirements.
vi.mock("@/components/admin/trader-decision-controls", () => ({
  TraderDecisionControls: ({ applicationId }: { applicationId: string }) => (
    <div data-testid="decision-controls" data-application-id={applicationId} />
  ),
}));

import AdminTraderApplicationsPage from "@/app/admin/trader-applications/page";

const APPLICATION = {
  applicantKind: "INDIVIDUAL",
  experience: "Six years sourcing components.",
  headline: "Component sourcing",
  id: "app-1",
  status: "PENDING_REVIEW",
  submittedAt: new Date("2026-08-01T12:00:00.000Z"),
  tradeCategory: "Electronics",
  user: { id: "user-1", name: "Maya Client", username: "maya-client" },
};

/** The real shape thrown when a relation is missing, as in the outage. */
function missingTableError() {
  return Object.assign(
    new Error(
      "The table `public.TraderApplication` does not exist in the current database.",
    ),
    { code: "P2021" },
  );
}

describe("admin trader applications outage isolation", () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireCapabilityOrNotFound.mockResolvedValue(undefined);
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders a degraded state instead of throwing when the query rejects", async () => {
    mocks.findMany.mockRejectedValue(missingTableError());

    const markup = renderToStaticMarkup(await AdminTraderApplicationsPage());

    // The admin shell survives: the section heading is still rendered, so the
    // surrounding layout and its nav are untouched.
    expect(markup).toContain("Trader applications");
    expect(markup).toMatch(/could not be loaded/i);
  });

  it("does not assert a cause it has not established", async () => {
    mocks.findMany.mockRejectedValue(missingTableError());

    const markup = renderToStaticMarkup(await AdminTraderApplicationsPage());

    // A missing table is a schema fault. Claiming connectivity is the exact
    // defect the taxonomy exists to prevent.
    expect(markup).not.toMatch(/connection/i);
    expect(markup).not.toMatch(/offline/i);
    expect(markup).not.toMatch(/check your/i);
  });

  it("never leaks the error message or stack into the rendered page", async () => {
    mocks.findMany.mockRejectedValue(missingTableError());

    const markup = renderToStaticMarkup(await AdminTraderApplicationsPage());

    expect(markup).not.toContain("TraderApplication");
    expect(markup).not.toContain("P2021");
    expect(markup).not.toContain("does not exist");
  });

  it("logs only the redacted digest/kind/route/timestamp shape", async () => {
    mocks.findMany.mockRejectedValue(missingTableError());

    await AdminTraderApplicationsPage();

    expect(errorSpy).toHaveBeenCalledTimes(1);
    const [, payload] = errorSpy.mock.calls[0] as [
      string,
      Record<string, unknown>,
    ];

    expect(Object.keys(payload).sort()).toEqual([
      "digest",
      "kind",
      "route",
      "timestamp",
    ]);
    expect(payload.route).toBe("/admin/trader-applications");
    expect(typeof payload.timestamp).toBe("string");

    // Nothing derived from the message may appear anywhere in the log call.
    const serialized = JSON.stringify(errorSpy.mock.calls);
    expect(serialized).not.toContain("TraderApplication");
    expect(serialized).not.toContain("does not exist");
    expect(serialized).not.toContain("P2021");
    expect(serialized).not.toMatch(/at \w+ \(/); // no stack frames
  });

  it("renders applications normally when the query resolves", async () => {
    mocks.findMany.mockResolvedValue([APPLICATION]);

    const markup = renderToStaticMarkup(await AdminTraderApplicationsPage());

    expect(markup).toContain("Maya Client");
    expect(markup).toContain("maya-client");
    expect(markup).toContain("Component sourcing");
    expect(markup).toContain("/admin/users/user-1");
    expect(markup).not.toMatch(/could not be loaded/i);
  });

  it("preserves the PAGE_SIZE bound and oldest-first ordering", async () => {
    mocks.findMany.mockResolvedValue([]);

    await AdminTraderApplicationsPage();

    expect(mocks.findMany).toHaveBeenCalledTimes(1);
    const args = mocks.findMany.mock.calls[0]?.[0];
    expect(args.take).toBe(20);
    expect(args.orderBy).toEqual([{ submittedAt: "asc" }, { id: "asc" }]);
    expect(args.where).toEqual({
      status: { in: ["PENDING_REVIEW", "NEEDS_CHANGES"] },
    });
    // The reviewer note stays out of the queue payload.
    expect(args.select.reviewerNote).toBeUndefined();
  });

  it("renders the existing empty state when the query resolves to []", async () => {
    mocks.findMany.mockResolvedValue([]);

    const markup = renderToStaticMarkup(await AdminTraderApplicationsPage());

    expect(markup).toContain("No applications to review");
    expect(markup).toContain(
      "Applications awaiting a decision will appear here.",
    );
    expect(markup).not.toMatch(/could not be loaded/i);
  });

  it("checks the capability before querying at all", async () => {
    mocks.findMany.mockResolvedValue([]);

    await AdminTraderApplicationsPage();

    expect(mocks.requireCapabilityOrNotFound).toHaveBeenCalledWith(
      "users:manage",
    );
    expect(
      mocks.requireCapabilityOrNotFound.mock.invocationCallOrder[0],
    ).toBeLessThan(mocks.findMany.mock.invocationCallOrder[0]);
  });

  it("lets notFound() from the capability guard propagate", async () => {
    // The real digest Next 16 attaches: `NEXT_HTTP_ERROR_FALLBACK;404`.
    const { notFound } = await import("next/navigation");
    mocks.requireCapabilityOrNotFound.mockImplementation(async () => {
      notFound();
    });

    await expect(AdminTraderApplicationsPage()).rejects.toMatchObject({
      digest: "NEXT_HTTP_ERROR_FALLBACK;404",
    });
    // An unauthorized visitor must never see a degraded state, because that
    // would confirm the page exists.
    expect(mocks.findMany).not.toHaveBeenCalled();
  });

  it("lets a redirect() from the capability guard propagate", async () => {
    const { redirect } = await import("next/navigation");
    mocks.requireCapabilityOrNotFound.mockImplementation(async () => {
      redirect("/sign-in");
    });

    await expect(AdminTraderApplicationsPage()).rejects.toMatchObject({
      digest: expect.stringContaining("NEXT_REDIRECT"),
    });
  });

  it("does not convert a control-flow error thrown mid-query into a degraded state", async () => {
    // Defence in depth: if anything inside the guarded region performs a
    // redirect (an auth refresh, say), the catch must not swallow it.
    const { notFound } = await import("next/navigation");
    mocks.findMany.mockImplementation(() => {
      notFound();
    });

    await expect(AdminTraderApplicationsPage()).rejects.toMatchObject({
      digest: "NEXT_HTTP_ERROR_FALLBACK;404",
    });
  });
});
