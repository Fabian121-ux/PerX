// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  submit: vi.fn(),
}));

vi.mock("@/features/proposals/actions", () => ({
  submitConversationProposalAction: mocks.submit,
}));

import { ConversationDealOfferDialog } from "@/components/messages/conversation-deal-offer-dialog";

beforeEach(() => { vi.clearAllMocks(); sessionStorage.clear(); });
afterEach(() => { cleanup(); sessionStorage.clear(); });

function renderDialog() {
  const onOpenChange = vi.fn();
  const onSubmitted = vi.fn();
  render(
    <ConversationDealOfferDialog
      conversationId="conversation-1"
      currentUserId="member-1"
      currency="NGN"
      onOpenChange={onOpenChange}
      onSubmitted={onSubmitted}
      open
      opportunityTitle="Service and delivery"
      participantName="Test partner"
    />,
  );
  const form = screen.getByRole("dialog").querySelector("form");
  if (!form) throw new Error("Missing Deal proposal form");
  return { form, onOpenChange, onSubmitted };
}

describe("chat Make a Deal / lock-terms proposal submission", () => {
  it("includes the explicit notice that locked terms do not hold real funds", () => {
    renderDialog();
    expect(screen.getByText(/does not hold funds/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit proposal" })).toBeInTheDocument();
  });

  it("ignores rapid duplicate submits and keeps the same retry ID", async () => {
    let finish!: (value: { error: string }) => void;
    const pending = new Promise<{ error: string }>((resolve) => { finish = resolve; });
    mocks.submit.mockReturnValueOnce(pending);
    mocks.submit.mockResolvedValueOnce({ error: "Try again later" });
    const { form } = renderDialog();

    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(mocks.submit).toHaveBeenCalledTimes(1);
    const firstKey = mocks.submit.mock.calls[0][0].clientRequestId;
    expect(typeof firstKey).toBe("string");
    expect(firstKey.length).toBeGreaterThan(0);

    await act(async () => {
      finish({ error: "Try again later" });
      await pending;
    });
    expect(screen.getByRole("alert")).toHaveTextContent("Try again later");

    await act(async () => {
      fireEvent.submit(form);
      await Promise.resolve();
    });
    expect(mocks.submit).toHaveBeenCalledTimes(2);
    expect(mocks.submit.mock.calls[1][0].clientRequestId).toBe(firstKey);
  });
  it("restores a draft after closing and reopening without sending to the server", async () => {
    const first = renderDialog();
    const amount = screen.getByRole("textbox", { name: /Agreement amount/ });
    const terms = screen.getByRole("textbox", { name: "Proposal terms" });
    fireEvent.change(amount, { target: { value: "185000" } });
    fireEvent.change(terms, { target: { value: "Build the requested dashboard with source code and acceptance tests." } });
    expect(screen.getByText(/Draft saved in this browser tab/i)).toBeInTheDocument();
    first.onOpenChange.mockClear();
    cleanup();

    renderDialog();
    await waitFor(() =>
      expect(screen.getByRole("textbox", { name: /Agreement amount/ })).toHaveValue("185000"),
    );
    expect(screen.getByRole("textbox", { name: "Proposal terms" }))
      .toHaveValue("Build the requested dashboard with source code and acceptance tests.");
    expect(mocks.submit).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Discard draft" }));
    expect(screen.getByRole("textbox", { name: /Agreement amount/ })).toHaveValue("");
    cleanup();

    renderDialog();
    await waitFor(() =>
      expect(screen.getByRole("textbox", { name: /Agreement amount/ })).toHaveValue(""),
    );
  });

  it("changes the retry idempotency key when failed terms are edited", async () => {
    mocks.submit.mockResolvedValue({ error: "Network unavailable." });
    const { form } = renderDialog();
    await act(async () => { fireEvent.submit(form); await Promise.resolve(); });
    const originalId = mocks.submit.mock.calls[0][0].clientRequestId;
    expect(screen.getByRole("alert")).toHaveTextContent("Network unavailable.");

    fireEvent.change(screen.getByRole("textbox", { name: /Agreement amount/ }), {
      target: { value: "190000" },
    });
    await act(async () => { fireEvent.submit(form); await Promise.resolve(); });
    expect(mocks.submit).toHaveBeenCalledTimes(2);
    expect(mocks.submit.mock.calls[1][0].clientRequestId).not.toBe(originalId);
  });

  it("clears on-device terms after a successful locked proposal submission", async () => {
    mocks.submit.mockResolvedValue({ success: true, event: {
      id: "event-1", proposalVersionId: "version-1",
      snapshot: {}, type: "PROPOSAL_SUBMITTED", createdAt: "2026-10-20T12:00:00.000Z",
      actorName: "Member", dealHref: null, proposalHref: "/app/proposals/sent",
    } });
    const { form, onSubmitted } = renderDialog();
    fireEvent.change(screen.getByRole("textbox", { name: /Agreement amount/ }), {
      target: { value: "190000" },
    });
    await act(async () => { fireEvent.submit(form); await Promise.resolve(); });
    await waitFor(() => expect(onSubmitted).toHaveBeenCalledTimes(1));
    expect(sessionStorage.length).toBe(0);
  });

});
