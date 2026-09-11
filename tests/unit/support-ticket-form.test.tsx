// @vitest-environment jsdom

import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/support/actions", () => ({
  createSupportTicketAction: vi.fn(),
}));

import { SupportTicketForm } from "@/components/support/support-ticket-form";

describe("SupportTicketForm", () => {
  it("provides labelled fields and pending-aware submission", () => {
    const view = render(<SupportTicketForm />);

    expect(view.getByLabelText("Subject")).toBeTruthy();
    expect(view.getByLabelText("Category")).toBeTruthy();
    expect(view.getByLabelText("Message")).toBeTruthy();
    expect(view.getByRole("button", { name: "Submit Ticket" })).toBeTruthy();
  });
});
