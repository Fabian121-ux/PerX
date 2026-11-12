// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  dismiss: vi.fn(),
  pathname: "/app",
}));

vi.mock("@/features/onboarding/actions", () => ({
  dismissOnboardingChecklistAction: mocks.dismiss,
}));

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

vi.mock("next/navigation", () => ({
  usePathname: () => mocks.pathname,
}));

import { WelcomeGuide } from "@/components/onboarding/welcome-guide";
import { SidebarNavigation } from "@/components/dashboard/dashboard-sidebar";

afterEach(() => {
  cleanup();
  mocks.pathname = "/app";
  vi.clearAllMocks();
});

describe("persistent getting started guide", () => {
  it("shows a guide entry in sidebar navigation", () => {
    render(<SidebarNavigation />);
    expect(
      screen.getByRole("button", { name: "Getting started guide" }),
    ).toBeInTheDocument();
  });

  it("opens again from the sidebar event after onboarding was dismissed", () => {
    mocks.dismiss.mockResolvedValue(undefined);
    render(<WelcomeGuide showWelcome={false} />);

    expect(
      screen.getByRole("button", { name: "Open the preX getting started guide" }),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Open the preX getting started guide" }),
    );
    expect(
      screen.getByRole("region", { name: "preX getting started guide" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Home" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Tuck guide into corner" }));
    expect(
      screen.getByRole("button", { name: "Open the preX getting started guide" }),
    ).toBeInTheDocument();

    act(() => {
      window.dispatchEvent(new Event("ptahx-open-guide"));
    });
    expect(
      screen.getByRole("region", { name: "preX getting started guide" }),
    ).toBeInTheDocument();
    expect(mocks.dismiss).not.toHaveBeenCalled();
  });
  it("recognises the Tracking Centre and gives tracking-specific next steps", () => {
    mocks.pathname = "/app/track";
    render(<WelcomeGuide showWelcome={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Open the preX getting started guide" }));
    expect(screen.getByRole("heading", { name: "Tracking Centre" })).toBeInTheDocument();
    expect(screen.getByText(/product agreements appear here automatically/i)).toBeInTheDocument();
    expect(screen.getByText(/Select a product agreement/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open Tracking Centre" })).toHaveAttribute("href", "/app/track");
  });

  it("recognises Deal delivery pages and explains submit or review actions", () => {
    mocks.pathname = "/app/deals/deal_123/deliveries";
    render(<WelcomeGuide showWelcome={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Open the preX getting started guide" }));
    expect(screen.getByRole("heading", { name: "Deal deliveries" })).toBeInTheDocument();
    expect(screen.getByText(/submitting work or reviewing a delivery/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to Deal" })).toHaveAttribute("href", "/app/deals/deal_123");
  });

});
