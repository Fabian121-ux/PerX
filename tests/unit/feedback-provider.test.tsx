// @vitest-environment jsdom

import { fireEvent, render, waitFor } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import {
  FeedbackProvider,
  useConfirm,
} from "@/components/ui/feedback-provider";
import { RouteFeedback } from "@/components/ui/route-feedback";

function ConfirmHarness() {
  const confirm = useConfirm();
  const [result, setResult] = useState("pending");

  return (
    <>
      <button
        onClick={async () => {
          const approved = await confirm({
            confirmLabel: "Remove",
            description: "This action cannot be silently reversed.",
            title: "Remove item?",
            tone: "danger",
          });
          setResult(approved ? "approved" : "cancelled");
        }}
        type="button"
      >
        Open confirmation
      </button>
      <output>{result}</output>
    </>
  );
}

describe("feedback provider", () => {
  it("focuses the safe action first and resolves confirmation", async () => {
    const view = render(
      <FeedbackProvider>
        <ConfirmHarness />
      </FeedbackProvider>,
    );

    fireEvent.click(view.getByRole("button", { name: "Open confirmation" }));
    const cancel = await view.findByRole("button", { name: "Cancel" });
    await waitFor(() => expect(document.activeElement).toBe(cancel));

    fireEvent.click(view.getByRole("button", { name: "Remove" }));
    await waitFor(() => expect(view.getByText("approved")).toBeTruthy());
  });

  it("can show the same route feedback after an empty route state", async () => {
    const feedback = {
      duration: null,
      title: "Changes saved",
      tone: "success" as const,
    };
    const view = render(
      <FeedbackProvider>
        <RouteFeedback feedback={feedback} />
      </FeedbackProvider>,
    );

    expect((await view.findByRole("status")).textContent).toContain("Changes saved");
    fireEvent.click(view.getByRole("button", { name: "Dismiss Changes saved" }));
    view.rerender(
      <FeedbackProvider>
        <RouteFeedback feedback={null} />
      </FeedbackProvider>,
    );
    await waitFor(() => expect(view.queryByRole("status")).toBeNull());
    view.rerender(
      <FeedbackProvider>
        <RouteFeedback feedback={feedback} />
      </FeedbackProvider>,
    );

    expect((await view.findByRole("status")).textContent).toContain("Changes saved");
  });
});
