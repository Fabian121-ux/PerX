// @vitest-environment jsdom

import { fireEvent, render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ decide: vi.fn() }));

vi.mock("@/features/trader/actions", () => ({
  decideTraderApplicationAction: mocks.decide,
}));

import { TraderDecisionControls } from "@/components/admin/trader-decision-controls";
import { FeedbackProvider } from "@/components/ui/feedback-provider";

describe("TraderDecisionControls", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retries the exact failed decision after pending state has cleared", async () => {
    mocks.decide
      .mockRejectedValueOnce(new Error("temporary failure"))
      .mockResolvedValueOnce(undefined);

    const view = render(
      <FeedbackProvider>
        <TraderDecisionControls applicationId="application-1" />
      </FeedbackProvider>,
    );

    fireEvent.click(view.getByRole("button", { name: "Approve" }));

    const retry = await view.findByRole("button", { name: "Retry" });
    expect(mocks.decide).toHaveBeenCalledTimes(1);

    fireEvent.click(retry);

    await waitFor(() => expect(mocks.decide).toHaveBeenCalledTimes(2));
    expect(
      (mocks.decide.mock.calls[1]?.[0] as FormData).get("decision"),
    ).toBe("APPROVED");
  });
});
