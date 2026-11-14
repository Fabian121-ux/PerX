import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ pathname: "/admin/users/user-123" }));
vi.mock("next/navigation", () => ({
  usePathname: () => mocks.pathname,
}));

import { AdminNavigation } from "@/components/admin/admin-navigation";

const groups = [
  {
    title: "Overview",
    links: [{ href: "/admin", label: "Dashboard" }],
  },
  {
    title: "People",
    links: [{ href: "/admin/users", label: "Users" }],
  },
];

describe("admin navigation component", () => {
  beforeEach(() => {
    mocks.pathname = "/admin/users/user-123";
  });

  it("highlights the current section for nested admin pages", () => {
    const markup = renderToStaticMarkup(<AdminNavigation groups={groups} />);

    expect(markup).toContain('href="/admin/users"');
    expect(markup).toContain('aria-current="page"');
    expect(markup).toContain("Admin navigation");
  });

  it("does not mark the dashboard active on another admin route", () => {
    const markup = renderToStaticMarkup(<AdminNavigation groups={groups} />);

    const dashboardLink = markup.match(/<a[^>]*href="\/admin"[^>]*>/)?.[0] ?? "";
    expect(dashboardLink).not.toContain('aria-current="page"');
  });
});
