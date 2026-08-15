// @vitest-environment jsdom

import { act, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
  error,
  userId = "user-1",
}: {
  defaultCategory?: string;
  defaultType?: string;
  error?: string;
  userId?: string;
} = {}) {
  return render(
    <FeedbackProvider>
      <OpportunityComposer
        defaultCategory={defaultCategory}
        defaultType={defaultType}
        error={error}
        userId={userId}
      />
    </FeedbackProvider>,
  );
}

describe("opportunity composer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    window.history.replaceState({}, "", "/app/opportunities/new");
    mocks.createOpportunity.mockResolvedValue(undefined);
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it("uses one app-shell main landmark and omits unavailable investment posts", async () => {
    const view = renderComposer();
    await act(async () => {});

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
      await view.findByRole("dialog", { name: "Leave Create Post?" }),
    ).toBeTruthy();
    fireEvent.click(view.getByRole("button", { name: "Cancel" }));
    expect(mocks.push).not.toHaveBeenCalled();

    fireEvent.click(view.getByRole("button", { name: "Back from Create Post" }));
    fireEvent.click(
      await view.findByRole("button", { name: "Leave and keep draft" }),
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
      await view.findByRole("dialog", { name: "Leave Create Post?" }),
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
      await view.findByRole("dialog", { name: "Leave Create Post?" }),
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
      await view.findByRole("dialog", { name: "Leave Create Post?" }),
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

  it("uses one mobile disclosure while keeping optional controls desktop-visible", async () => {
    const view = renderComposer();
    await act(async () => {});
    const toggle = view.getByRole("button", {
      name: "Budget, location and participation",
    });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    const section = document.getElementById(toggle.getAttribute("aria-controls")!);
    expect(section?.className).toContain("hidden");
    expect(section?.className).toContain("sm:grid");
    expect(view.getAllByLabelText("Currency")).toHaveLength(1);

    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(section?.className).toContain("grid");
  });

  it("starts optional controls open when server validation returned an error", async () => {
    const view = renderComposer({ error: "Check your inputs" });
    await act(async () => {});
    expect(
      view
        .getByRole("button", { name: "Budget, location and participation" })
        .getAttribute("aria-expanded"),
    ).toBe("true");
  });

  it("restores only the authenticated user and type draft after hydration", async () => {
    window.localStorage.setItem(
      "perx:opportunity-composer:v1:user-1:SERVICE",
      JSON.stringify({
        fields: {
          budgetMax: "1200",
          budgetMin: "500",
          category: "services",
          contactPreference: "",
          currency: "USD",
          description: "Restored description",
          listingRulesAccepted: false,
          location: "Lagos",
          propertyListingType: "",
          propertyType: "",
          remote: true,
          skills: "Design",
          summary: "Restored summary",
          title: "Restored service title",
        },
        savedAt: Date.now(),
        type: "SERVICE",
        version: 1,
      }),
    );
    const view = renderComposer();
    await waitFor(() =>
      expect((view.getByLabelText("Post title") as HTMLInputElement).value).toBe(
        "Restored service title",
      ),
    );
    expect(view.getByText("Restored local draft")).toBeTruthy();

    view.unmount();
    const other = renderComposer({ userId: "user-2" });
    await act(async () => Promise.resolve());
    expect((other.getByLabelText("Post title") as HTMLInputElement).value).toBe(
      "",
    );
  });

  it("autosaves by type, restores on switch, and excludes authority text", async () => {
    const view = renderComposer();
    fireEvent.change(view.getByLabelText("Post title"), {
      target: { value: "Service type draft" },
    });
    await waitFor(() => expect(view.getByText("Saved locally")).toBeTruthy(), {
      timeout: 1500,
    });
    expect(
      window.localStorage.getItem(
        "perx:opportunity-composer:v1:user-1:SERVICE",
      ),
    ).toContain("Service type draft");

    fireEvent.change(view.getByLabelText("Post type"), {
      target: { value: "PROPERTY" },
    });
    expect((view.getByLabelText("Category") as HTMLSelectElement).value).toBe(
      "real-estate",
    );
    fireEvent.change(view.getByLabelText("Post title"), {
      target: { value: "Property type draft" },
    });
    fireEvent.change(view.getByLabelText("Ownership or authority declaration"), {
      target: { value: "Sensitive proof must not be in browser storage" },
    });
    await waitFor(() =>
      expect(
        window.localStorage.getItem(
          "perx:opportunity-composer:v1:user-1:PROPERTY",
        ),
      ).toContain("Property type draft"),
    );
    expect(
      window.localStorage.getItem(
        "perx:opportunity-composer:v1:user-1:PROPERTY",
      ),
    ).not.toContain("Sensitive proof");

    fireEvent.change(view.getByLabelText("Post type"), {
      target: { value: "SERVICE" },
    });
    expect((view.getByLabelText("Post title") as HTMLInputElement).value).toBe(
      "Service type draft",
    );
  });
});
