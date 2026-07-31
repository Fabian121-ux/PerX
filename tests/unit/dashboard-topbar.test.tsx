import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", async () => {
  const React = await import("react");
  return {
    default: ({
      children,
      href,
      ...props
    }: {
      children: React.ReactNode;
      href: string;
      [key: string]: unknown;
    }) => React.createElement("a", { ...props, href }, children),
  };
});
vi.mock("@/components/brand-logo", () => ({
  BrandLogo: () => null,
}));
vi.mock("@/components/navigation/feature-directory", () => ({
  FeatureDirectory: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("@/components/navigation/secondary-menu", () => ({
  SecondaryMenu: () => null,
}));
vi.mock("@/components/dashboard/account-menu", () => ({
  AccountMenu: () => null,
}));
vi.mock("@/components/dashboard/create-menu", () => ({
  CreateMenu: () => null,
}));
vi.mock("@/components/dashboard/theme-toggle", () => ({
  ThemeToggle: () => null,
}));

import { DashboardTopbar } from "@/components/dashboard/dashboard-topbar";

describe("dashboard topbar destinations", () => {
  it("points desktop and mobile search to unified search and exposes News in both controls", () => {
    const markup = renderToStaticMarkup(
      <DashboardTopbar
        unreadCounts={{
          generalActivity: 4,
          pendingConnectionRequests: 2,
          unreadConversations: 3,
          unreadNews: 7,
        }}
        user={
          {
            email: "member@perx.test",
            id: "user-1",
            name: "Member",
            roles: [],
            username: "member",
          } as never
        }
      />,
    );

    expect(markup).toContain('action="/app/search"');
    expect(markup).toContain('href="/app/search"');
    expect(markup.match(/href="\/app\/news"/g)).toHaveLength(2);
    expect(markup.match(/aria-label="News, unread"/g)).toHaveLength(2);
    expect(markup).not.toContain("7 unread News");
  });
});
