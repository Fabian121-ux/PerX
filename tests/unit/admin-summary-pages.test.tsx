import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAdminDealsPage: vi.fn(),
  getAdminUsersPage: vi.fn(),
  requireCapabilityOrNotFound: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  requireCapabilityOrNotFound: mocks.requireCapabilityOrNotFound,
}));
vi.mock("@/lib/data/admin", () => ({
  getAdminDealsPage: mocks.getAdminDealsPage,
  getAdminUsersPage: mocks.getAdminUsersPage,
}));

import AdminDealsPage from "@/app/admin/deals/page";
import AdminUsersPage from "@/app/admin/users/(list)/page";

describe("admin operational summary pages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireCapabilityOrNotFound.mockResolvedValue(undefined);
    mocks.getAdminUsersPage.mockResolvedValue({
      cursor: null,
      items: [
        {
          accountClassification: "PUBLIC_BETA_USER",
          accountState: "ACTIVE",
          activeRestrictions: [],
          activity: {
            completedAgreements: 2,
            ownedOpportunities: 3,
            publicReviewsReceived: 4,
          },
          createdAt: new Date("2026-08-01T12:00:00.000Z"),
          email: "maya@example.com",
          id: "user-1",
          name: "Maya Client",
          roles: [{ label: "Client", name: "CLIENT" }],
          suspendedUntil: null,
          username: "maya-client",
          verificationStatus: "VERIFIED",
        },
      ],
      nextCursor: null,
      pageSize: 20,
    });
    mocks.getAdminDealsPage.mockResolvedValue({
      cursor: null,
      items: [
        {
          currency: "NGN",
          id: "deal-1",
          milestoneCount: 3,
          participantCount: 8,
          participantPreview: [
            {
              role: "client",
              user: { name: "Maya Client", username: "maya-client" },
            },
          ],
          settlementMode: "PROVIDER_DISABLED",
          status: "IN_PROGRESS",
          title: "Keyboard delivery",
          unresolvedDisputeCount: 1,
          updatedAt: new Date("2026-08-13T12:00:00.000Z"),
          valueMinor: 25_000_000n,
        },
      ],
      nextCursor: null,
      pageSize: 20,
    });
  });

  it("renders typed user summaries that navigate to detail without mutating", async () => {
    const markup = renderToStaticMarkup(
      await AdminUsersPage({ searchParams: Promise.resolve({}) }),
    );

    expect(mocks.requireCapabilityOrNotFound).toHaveBeenCalledWith(
      "users:read",
    );
    expect(markup).toContain("Maya Client");
    expect(markup).toContain("3 opportunities");
    expect(markup).toContain("2 completed agreements");
    expect(markup).toContain("4 public reviews");
    // Navigation is expected; mutation is not. Account actions live on the
    // detail record, where the capability is re-checked and the change is
    // audited against a named user.
    expect(markup).toContain("/admin/users/user-1");
    expect(markup).not.toContain("<form");
    expect(markup).not.toContain("<button");
    expect(markup).not.toContain("<input");
  });

  it("renders bounded Deal counts and settlement disclosure without transitions", async () => {
    const markup = renderToStaticMarkup(
      await AdminDealsPage({ searchParams: Promise.resolve({}) }),
    );

    expect(mocks.requireCapabilityOrNotFound).toHaveBeenCalledWith(
      "deals:review",
    );
    expect(markup).toContain("Keyboard delivery");
    expect(markup).toContain("Deal reference: deal-1");
    expect(markup).toContain("Online payment unavailable");
    expect(markup).toContain("8 participants");
    expect(markup).toContain("3 milestones");
    expect(markup).toContain("1 unresolved disputes");
    expect(markup).toContain("+7 more");
    expect(markup).not.toContain("/admin/deals/deal-1");
    expect(markup).not.toContain("<form");
  });
});
