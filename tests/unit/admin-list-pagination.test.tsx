import { renderToStaticMarkup } from "react-dom/server";
import { AdminList } from "@/components/admin-section";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAdminListPage: vi.fn(),
  requireCapabilityOrNotFound: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  requireCapabilityOrNotFound: mocks.requireCapabilityOrNotFound,
}));
vi.mock("@/lib/data/admin", () => ({
  getAdminListPage: mocks.getAdminListPage,
}));

import AdminProfilesPage from "@/app/admin/profiles/page";
import AdminOpportunitiesPage from "@/app/admin/opportunities/page";
import AdminDisputesPage from "@/app/admin/disputes/page";
import AdminVerificationPage from "@/app/admin/verification/page";
import AdminReviewsPage from "@/app/admin/reviews/page";

const updatedAt = new Date("2026-11-01T12:00:00.000Z");

const routes = [
  {
    kind: "profiles",
    Page: AdminProfilesPage,
    item: {
      id: "profile-1",
      headline: "Product founder",
      profileCompleteness: 92,
      trustScore: 67,
      updatedAt,
      user: { id: "user-profile", name: "Profile User", username: "profile-user" },
    },
    href: "/admin/profiles?cursor=next-token",
    relatedHref: "/admin/users/user-profile",
    capability: "users:read",
  },
  {
    kind: "opportunities",
    Page: AdminOpportunitiesPage,
    item: {
      id: "opportunity-1",
      moderationStatus: "PENDING",
      owner: { id: "user-owner", name: "Listing Owner", username: "listing-owner" },
      status: "PUBLISHED",
      title: "Frontend role",
      type: "JOB",
      updatedAt,
    },
    href: "/admin/opportunities?cursor=next-token",
    relatedHref: "/admin/users/user-owner",
    capability: "opportunity:moderate",
  },
  {
    kind: "disputes",
    Page: AdminDisputesPage,
    item: {
      id: "dispute-1",
      openedBy: { id: "user-opener", name: "Dispute Opener", username: "dispute-opener" },
      reason: "Milestone disagreement",
      resolution: null,
      status: "OPEN",
      updatedAt,
    },
    href: "/admin/disputes?cursor=next-token",
    relatedHref: "/admin/users/user-opener",
    capability: "deals:review",
  },
  {
    kind: "verification",
    Page: AdminVerificationPage,
    item: {
      id: "verification-1",
      notes: "Identity document received",
      profile: {
        headline: "Independent designer",
        user: { id: "user-verification", name: "Verification User", username: "verification-user" },
      },
      status: "PENDING",
      updatedAt,
    },
    href: "/admin/verification?cursor=next-token",
    relatedHref: "/admin/users/user-verification",
    capability: "admin:moderate",
  },
  {
    kind: "reviews",
    Page: AdminReviewsPage,
    item: {
      author: { id: "user-author", name: "Review Author", username: "review-author" },
      body: "Reliable and clear communication.",
      createdAt: updatedAt,
      dealId: "deal-reference",
      id: "review-1",
      rating: 5,
      subject: { id: "user-subject", name: "Review Subject", username: "review-subject" },
      title: "Clear communication",
      visibility: "PUBLIC",
    },
    href: "/admin/reviews?cursor=next-token",
    relatedHref: "/admin/users/user-author",
    capability: "reports:review",
  },
] as const;

describe("admin operational list pagination", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireCapabilityOrNotFound.mockResolvedValue({ id: "admin-1" });
    mocks.getAdminListPage.mockImplementation(async (kind: string) => {
      const item = routes.find((route) => route.kind === kind)?.item;
      return {
        cursor: "current-token",
        items: item ? [item] : [],
        nextCursor: "next-token",
      };
    });
  });

  it("makes records beyond the first page reachable and links related records", async () => {
    for (const route of routes) {
      const markup = renderToStaticMarkup(
        await route.Page({
          searchParams: Promise.resolve({ cursor: "current-token" }),
        }),
      );

      expect(mocks.requireCapabilityOrNotFound).toHaveBeenCalledWith(
        route.capability,
      );
      expect(mocks.getAdminListPage).toHaveBeenCalledWith(route.kind, {
        cursor: "current-token",
        pageSize: 20,
      });
      expect(markup).toContain(route.href);
      expect(markup).toContain(route.relatedHref);
      expect(markup).toContain("Next");
    }
  });

  it("uses a neutral empty state instead of suggesting production needs seeding", () => {
    const markup = renderToStaticMarkup(
      <AdminList<{ id: string }>
        empty="No profiles"
        items={[]}
        render={(item) => <p>{item.id}</p>}
      />,
    );
    expect(markup).not.toContain("Connect PostgreSQL");
    expect(markup).toContain(
      "There are no records to display in this view right now.",
    );
  });
});
