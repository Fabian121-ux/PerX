// @vitest-environment jsdom

import { act, fireEvent, render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createOpportunity: vi.fn(),
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
}));
vi.mock("@/features/opportunities/actions", () => ({
  createOpportunityAction: mocks.createOpportunity,
}));

import { OpportunityComposer } from "@/components/opportunities/opportunity-composer";
import { FeedbackProvider } from "@/components/ui/feedback-provider";

function renderComposer({
  defaultCategory = "services",
  defaultType = "SERVICE",
}: {
  defaultCategory?: string;
  defaultType?: string;
} = {}) {
  return render(
    <FeedbackProvider>
      <OpportunityComposer
        defaultCategory={defaultCategory}
        defaultType={defaultType}
      />
    </FeedbackProvider>,
  );
}

describe("opportunity composer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState({}, "", "/app/opportunities/new");
    mocks.createOpportunity.mockResolvedValue(undefined);
  });

  it("uses one app-shell main landmark and omits unavailable investment posts", () => {
    const view = renderComposer();

    expect(view.container.querySelector("main")).toBeNull();
    expect(view.getByRole("option", { name: "Service" })).toBeTruthy();
    expect(view.queryByRole("option", { name: "Investment" })).toBeNull();
  });

  it("confirms before discarding entered content", async () => {
    const view = renderComposer();
    fireEvent.change(view.getByLabelText("Post title"), {
      target: { value: "A useful service post" },
    });

    fireEvent.click(view.getByRole("button", { name: "Back from Create Post" }));
    expect(
      await view.findByRole("dialog", { name: "Discard this draft?" }),
    ).toBeTruthy();
    fireEvent.click(view.getByRole("button", { name: "Cancel" }));
    expect(mocks.push).not.toHaveBeenCalled();

    fireEvent.click(view.getByRole("button", { name: "Back from Create Post" }));
    fireEvent.click(
      await view.findByRole("button", { name: "Discard changes" }),
    );
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/app"));
  });

  it("guards browser back navigation after content is entered", async () => {
    const view = renderComposer();
    fireEvent.change(view.getByLabelText("Post title"), {
      target: { value: "A useful service post" },
    });
    await waitFor(() =>
      expect(window.history.state).toEqual(
        expect.objectContaining({ perxOpportunityComposerGuard: true }),
      ),
    );

    await act(async () => {
      window.dispatchEvent(new PopStateEvent("popstate"));
      window.dispatchEvent(new PopStateEvent("popstate"));
      await Promise.resolve();
    });

    expect(
      await view.findByRole("dialog", { name: "Discard this draft?" }),
    ).toBeTruthy();
    fireEvent.click(view.getByRole("button", { name: "Cancel" }));
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("disarms the browser-history guard when entered content is cleared", async () => {
    const view = renderComposer();
    const title = view.getByLabelText("Post title");
    fireEvent.change(title, {
      target: { value: "A useful service post" },
    });
    await waitFor(() =>
      expect(window.history.state).toEqual(
        expect.objectContaining({ perxOpportunityComposerGuard: true }),
      ),
    );

    fireEvent.change(title, { target: { value: "" } });

    await waitFor(() =>
      expect(window.history.state).not.toEqual(
        expect.objectContaining({ perxOpportunityComposerGuard: true }),
      ),
    );
  });

  it("treats changed select defaults as unsaved content", async () => {
    const view = renderComposer();
    fireEvent.change(view.getByLabelText("Currency"), {
      target: { value: "USD" },
    });

    fireEvent.click(view.getByRole("button", { name: "Back from Create Post" }));

    expect(
      await view.findByRole("dialog", { name: "Discard this draft?" }),
    ).toBeTruthy();
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("treats a property contact selection as unsaved content", async () => {
    const view = renderComposer({
      defaultCategory: "real-estate",
      defaultType: "PROPERTY",
    });
    fireEvent.change(view.getByLabelText("Contact preference"), {
      target: { value: "PERX_MESSAGES" },
    });

    fireEvent.click(view.getByRole("button", { name: "Back from Create Post" }));

    expect(
      await view.findByRole("dialog", { name: "Discard this draft?" }),
    ).toBeTruthy();
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("announces draft and publish submissions distinctly", async () => {
    const view = renderComposer();
    const form = view.container.querySelector("form");
    if (!form) throw new Error("Composer form missing");

    const draftButton = view.getByRole("button", { name: "Save draft" });
    fireEvent(
      form,
      new SubmitEvent("submit", {
        bubbles: true,
        cancelable: true,
        submitter: draftButton,
      }),
    );

    expect(await view.findByText("Saving draft")).toBeTruthy();
  });
});
