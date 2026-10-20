// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  submit: vi.fn(),
}));

vi.mock("@/features/proposals/actions", () => ({
  submitConversationProposalAction: mocks.submit,
}));

import { ConversationDealOfferDialog } from "@/components/messages/conversation-deal-offer-dialog";

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

function renderDialog() {
  const onOpenChange = vi.fn();
  const onSubmitted = vi.fn();
  render(
    <ConversationDealOfferDialog
      conversationId="conversation-1"
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
});
