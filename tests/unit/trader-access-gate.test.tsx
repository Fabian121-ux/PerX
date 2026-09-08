// @vitest-environment jsdom

import { fireEvent, render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ refresh: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));

import { TraderAccessGate } from "@/components/trader/trader-access-gate";

describe("TraderAccessGate", () => {
  it("does not turn a failed status lookup into a new Trader application state", async () => {
    const view = render(
      <TraderAccessGate application={null} unavailable />,
    );

    expect(
      view.getByRole("heading", {
        name: "Trader status is temporarily unavailable",
      }),
    ).toBeTruthy();
    expect(view.queryByRole("link", { name: "Become a Trader" })).toBeNull();
    expect(
      view.getByText(/existing application, if any, has not changed/i),
    ).toBeTruthy();

    fireEvent.click(view.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledTimes(1));
  });
});
