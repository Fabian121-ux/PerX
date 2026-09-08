// @vitest-environment jsdom

import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-dom")>();
  return {
    ...actual,
    useFormStatus: () => ({
      action: null,
      data: null,
      method: null,
      pending: true,
    }),
  };
});

import { PendingSubmitButton } from "@/components/ui/pending-submit-button";

describe("PendingSubmitButton", () => {
  it("announces and disables pending form submissions", () => {
    const view = render(
      <PendingSubmitButton pendingLabel="Saving..." type="submit">
        Save
      </PendingSubmitButton>,
    );

    const button = view.getByRole("button", { name: "Saving..." });
    expect(button.getAttribute("aria-busy")).toBe("true");
    expect((button as HTMLButtonElement).disabled).toBe(true);
  });
});
