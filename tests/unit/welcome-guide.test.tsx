// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  dismiss: vi.fn(),
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
  usePathname: () => "/app",
}));

import { WelcomeGuide } from "@/components/onboarding/welcome-guide";
import { SidebarNavigation } from "@/components/dashboard/dashboard-sidebar";

afterEach(() => {
  cleanup();
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

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    act(() => {
      window.dispatchEvent(new Event("ptahx-open-guide"));
    });

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Start with News" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Close guide" }));
    expect(mocks.dismiss).toHaveBeenCalledTimes(1);
  });
});
