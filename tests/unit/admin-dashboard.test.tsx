import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAdminMetrics: vi.fn(),
  requireCapabilityOrNotFound: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  requireCapabilityOrNotFound: mocks.requireCapabilityOrNotFound,
}));
vi.mock("@/lib/data/admin", () => ({
  getAdminMetrics: mocks.getAdminMetrics,
}));

import AdminDashboardPage from "@/app/admin/(overview)/page";

describe("admin dashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireCapabilityOrNotFound.mockResolvedValue({
      id: "admin-1",
      roles: ["ADMIN"],
    });
    mocks.getAdminMetrics.mockResolvedValue({
      auditLogs: 108,
      disputes: 4,
      opportunities: 28,
      reports: 6,
      reviews: 32,
      users: 240,
      verification: 3,
    });
  });

  it("renders every available metric as a link to its workspace", async () => {
    const markup = renderToStaticMarkup(await AdminDashboardPage());

    expect(mocks.requireCapabilityOrNotFound).toHaveBeenCalledWith("admin:access");
    for (const label of ["Users", "Opportunities", "Reports", "Reviews", "Disputes", "Verification", "Audit logs"]) {
      expect(markup).toContain(label);
    }
    expect(markup).toContain('href="/admin/users"');
    expect(markup).toContain('href="/admin/disputes"');
    expect(markup).toContain('href="/admin/audit"');
    expect(markup).toContain("108");
  });

  it("provides accessible names for dashboard workspace links", async () => {
    const markup = renderToStaticMarkup(await AdminDashboardPage());

    expect(markup).toContain('aria-label="Users: 240. Open users"');
    expect(markup).toContain('aria-label="Verification: 3. Open verification"');
  });
});
