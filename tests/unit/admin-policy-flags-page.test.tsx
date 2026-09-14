import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { buildPublicOpportunityWhere } from "@/lib/data/public-opportunities";

/**
 * The list view that makes a policy flag actionable.
 *
 * The case detail page already existed and worked; nothing linked to it, so a
 * flagged listing was unreachable in practice. This is the index that closes
 * that gap.
 */

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  findManyUsers: vi.fn(),
  requireCapabilityOrNotFound: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  requireCapabilityOrNotFound: mocks.requireCapabilityOrNotFound,
}));
vi.mock("@/lib/db/prisma", () => ({
  getPrisma: () => ({
    moderationCase: { findMany: mocks.findMany },
    user: { findMany: mocks.findManyUsers },
  }),
}));

import AdminPolicyFlagsPage from "@/app/admin/moderation/policy-flags/page";

// `reportedUserId` carries no Prisma relation, so the page hydrates authors
// with a second query - the fixtures mirror that.
const CASE_ROW = {
  category: "UNSAFE_LINK",
  createdAt: new Date("2026-09-01T12:00:00.000Z"),
  id: "case-1",
  reportedUserId: "owner-1",
  status: "NEW",
  summary:
    "Content contains a shortened URL commonly used to obscure destinations. Outcome FLAG from detector unsafe-link-shortener-v1.",
  targetId: "opportunity-1",
  title: "Policy flag on opportunity",
};

const AUTHOR_ROW = {
  id: "owner-1",
  isActive: true,
  name: "Alice Author",
  username: "alice_test",
};

describe("admin policy flags list", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireCapabilityOrNotFound.mockResolvedValue({ id: "admin-1" });
    mocks.findMany.mockResolvedValue([CASE_ROW]);
    mocks.findManyUsers.mockResolvedValue([AUTHOR_ROW]);
  });

  it("lists open policy-flag cases with what an admin needs to decide", async () => {
    const markup = renderToStaticMarkup(await AdminPolicyFlagsPage());

    expect(markup).toContain("alice_test");
    // formatAdminValue lowercases and de-underscores, as everywhere else in admin.
    expect(markup).toContain("unsafe link");
    // Admins MAY see the rule detail - this is the admin side of the boundary.
    expect(markup).toMatch(/shortened URL/i);
    expect(markup).toContain("/admin/moderation/cases/case-1");
  });

  it("queries only open POLICY_FLAG cases, oldest first, bounded", async () => {
    await AdminPolicyFlagsPage();

    const args = mocks.findMany.mock.calls[0]?.[0];
    expect(args?.where?.source).toBe("POLICY_FLAG");
    expect(args?.where?.status).toEqual({
      notIn: ["RESOLVED", "DISMISSED", "CLOSED"],
    });
    // Oldest first: the author who has waited longest is served first.
    expect(args?.orderBy).toEqual([{ createdAt: "asc" }, { id: "asc" }]);
    expect(args?.take).toBe(50);
  });

  it("renders an empty state rather than implying work exists", async () => {
    mocks.findMany.mockResolvedValue([]);

    const markup = renderToStaticMarkup(await AdminPolicyFlagsPage());

    expect(markup).toMatch(/no .*polic|nothing/i);
  });

  it("renders a degraded state instead of throwing when the query fails", async () => {
    mocks.findMany.mockRejectedValue(
      Object.assign(new Error("relation does not exist"), { code: "P2021" }),
    );

    const markup = renderToStaticMarkup(await AdminPolicyFlagsPage());

    expect(markup).toMatch(/could not be loaded/i);
    // The raw error must not reach the page.
    expect(markup).not.toContain("P2021");
    expect(markup).not.toContain("relation does not exist");
  });

  it("degrades rather than 500s when author hydration fails", async () => {
    mocks.findManyUsers.mockRejectedValue(new Error("user query failed"));

    const markup = renderToStaticMarkup(await AdminPolicyFlagsPage());

    expect(markup).toMatch(/could not be loaded/i);
    expect(markup).not.toContain("user query failed");
  });

  it("still renders a case whose author row is missing", async () => {
    mocks.findManyUsers.mockResolvedValue([]);

    const markup = renderToStaticMarkup(await AdminPolicyFlagsPage());

    expect(markup).toContain("/admin/moderation/cases/case-1");
    expect(markup).toMatch(/Unavailable account/i);
  });

  it("lets notFound from the capability guard propagate", async () => {
    const { notFound } = await import("next/navigation");
    mocks.requireCapabilityOrNotFound.mockImplementation(async () => {
      notFound();
    });

    await expect(AdminPolicyFlagsPage()).rejects.toMatchObject({
      digest: "NEXT_HTTP_ERROR_FALLBACK;404",
    });
    expect(mocks.findMany).not.toHaveBeenCalled();
  });

  it("gates on admin:moderate before querying", async () => {
    await AdminPolicyFlagsPage();

    expect(mocks.requireCapabilityOrNotFound).toHaveBeenCalledWith(
      "admin:moderate",
    );
  });
});

describe("decision outcome reaches the public feed", () => {
  it("requires APPROVED, so a cleared listing enters and an upheld one does not", () => {
    const where = buildPublicOpportunityWhere();

    // Clearing sets APPROVED; upholding sets REJECTED. This is the filter that
    // makes that difference real rather than cosmetic.
    expect(where.moderationStatus).toBe("APPROVED");
  });
});
