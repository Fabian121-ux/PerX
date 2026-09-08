// @vitest-environment jsdom

import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ submit: vi.fn() }));

vi.mock("@/features/trader/actions", () => ({
  submitTraderApplicationAction: mocks.submit,
}));

import { TraderApplicationForm } from "@/components/trader/trader-application-form";

describe("TraderApplicationForm", () => {
  it("keeps Continue on the current step until its required answers are valid", () => {
    const view = render(
      <TraderApplicationForm
        categories={[{ label: "Software", value: "software" }]}
      />,
    );

    expect(view.getByText("Step 1 of 3")).toBeTruthy();
    fireEvent.click(view.getByRole("button", { name: "Continue" }));
    expect(view.getByText("Step 1 of 3")).toBeTruthy();

    fireEvent.change(view.getByLabelText("Describe it briefly"), {
      target: { value: "Software services for growing teams" },
    });
    fireEvent.click(view.getByRole("button", { name: "Continue" }));
    expect(view.getByText("Step 2 of 3")).toBeTruthy();

    fireEvent.click(view.getByRole("button", { name: "Continue" }));
    expect(view.getByText("Step 2 of 3")).toBeTruthy();

    fireEvent.change(
      view.getByLabelText("What relevant experience do you have?"),
      {
        target: {
          value:
            "I have delivered software projects for several growing teams and clients.",
        },
      },
    );
    fireEvent.click(view.getByRole("button", { name: "Continue" }));
    expect(view.getByText("Step 3 of 3")).toBeTruthy();
    expect(view.getByRole("button", { name: "Submit application" })).toBeTruthy();

    fireEvent.click(view.getByRole("button", { name: "Back" }));
    expect(view.getByText("Step 2 of 3")).toBeTruthy();
  });
});
