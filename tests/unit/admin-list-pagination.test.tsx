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

const routes = [
  {
    kind: "profiles",
    Page: AdminProfilesPage,
    item: { id: "profile-1", headline: "Product founder" },
    href: "/admin/profiles?cursor=next-token",
    capability: "users:read",
  },
  {
    kind: "opportunities",
    Page: AdminOpportunitiesPage,
    item: { id: "opportunity-1", title: "Frontend role" },
    href: "/admin/opportunities?cursor=next-token",
    capability: "opportunity:moderate",
  },
  {
    kind: "disputes",
    Page: AdminDisputesPage,
    item: { id: "dispute-1", reason: "Milestone disagreement" },
    href: "/admin/disputes?cursor=next-token",
    capability: "deals:review",
  },
  {
    kind: "verification",
    Page: AdminVerificationPage,
    item: { id: "verification-1", status: "PENDING" },
    href: "/admin/verification?cursor=next-token",
    capability: "admin:moderate",
  },
  {
    kind: "reviews",
    Page: AdminReviewsPage,
    item: { id: "review-1", title: "Clear communication" },
    href: "/admin/reviews?cursor=next-token",
    capability: "reports:review",
  },
] as const;

describe("admin operational list pagination", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireCapabilityOrNotFound.mockResolvedValue({ id: "admin-1" });
    mocks.getAdminListPage.mockImplementation(async (kind: string) => ({
      cursor: "current-token",
      items: [routes.find((route) => route.kind === kind)?.item],
      nextCursor: "next-token",
    }));
  });

  it("makes records beyond the first page reachable in every summary list", async () => {
    for (const route of routes) {
      const markup = renderToStaticMarkup(
        await route.Page({ searchParams: Promise.resolve({ cursor: "current-token" }) }),
      );

      expect(mocks.requireCapabilityOrNotFound).toHaveBeenCalledWith(route.capability);
      expect(mocks.getAdminListPage).toHaveBeenCalledWith(route.kind, {
        cursor: "current-token",
        pageSize: 20,
      });
      expect(markup).toContain(route.href);
      expect(markup).toContain("Next");
    }
  });

  it("uses a neutral empty state instead of suggesting production needs seeding", () => {
    // The shared AdminList copy is asserted separately through the component's
    // rendered empty state because an empty queue is a valid production state.
    const markup = renderToStaticMarkup(
      <AdminList
        empty="No profiles"
        items={[]}
        render={(item) => <p>{item.id}</p>}
      />,
    );
    expect(markup).not.toContain("Connect PostgreSQL");
    expect(markup).toContain("There are no records to display in this view right now.");
  });
});
