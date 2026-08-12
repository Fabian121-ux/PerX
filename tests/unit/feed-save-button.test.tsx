// @vitest-environment jsdom

import { fireEvent, render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ setBookmark: vi.fn() }));

vi.mock("@/features/opportunities/actions", () => ({
  setOpportunityBookmarkAction: mocks.setBookmark,
}));

import { FeedSaveButton } from "@/components/dashboard/feed-save-button";
import { FeedbackProvider } from "@/components/ui/feedback-provider";

describe("feed save button", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rolls back optimistic state when the mutation rejects", async () => {
    mocks.setBookmark.mockRejectedValue(new Error("offline"));
    const view = render(
      <FeedbackProvider>
        <FeedSaveButton initialSaved={false} opportunityId="opportunity-1" />
      </FeedbackProvider>,
    );

    fireEvent.click(view.getByRole("button", { name: "Save opportunity" }));

    expect(await view.findByRole("alert")).toBeTruthy();
    await waitFor(() =>
      expect(
        view.getByRole("button", { name: "Save opportunity" }).getAttribute(
          "aria-pressed",
        ),
      ).toBe("false"),
    );
  });
});
