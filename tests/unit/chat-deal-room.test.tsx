// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChatDealRoom } from "@/components/messages/chat-deal-room";
import type { WorkspaceConversation } from "@/components/messages/message-workspace";

afterEach(cleanup);

const base: WorkspaceConversation = {
  id: "c1", participantName: "Seller", messages: [],
  dealOffer: { opportunityTitle: "Delivery", currency: "NGN" },
  events: [{
    id: "event-1", type: "PROPOSAL_SUBMITTED", actorName: "Buyer",
    createdAt: "2026-10-20T10:00:00.000Z", snapshot: { versionNumber: 1 },
    proposalHref: "/app/proposals/version-1",
  }],
};

describe("conversation Deal room uses real versioned records", () => {
  it("opens a mobile bottom sheet and leads to existing lock-terms proposal form", () => {
    const onCreateTerms = vi.fn();
    const onOpenChange = vi.fn();
    render(<ChatDealRoom conversation={base} open onCreateTerms={onCreateTerms} onOpenChange={onOpenChange} />);
    expect(screen.getByRole("dialog", { name: "Deal room" })).toBeInTheDocument();
    expect(screen.getByText(/Locking terms does not lock or hold money/i)).toBeInTheDocument();
    expect(screen.getByText(/Submitted versions are immutable/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Review locked proposal/ })).toHaveAttribute("href", "/app/proposals/version-1");
    fireEvent.click(screen.getByRole("button", { name: /Draft and submit locked terms/ }));
    expect(onCreateTerms).toHaveBeenCalledTimes(1);
  });
  it("opens the actual accepted Deal workspace, not another unrelated messaging route", () => {
    render(<ChatDealRoom conversation={{
      ...base, dealOffer: undefined, dealHref: "/app/deals/real-deal-1",
      deal: { id: "real-deal-1", title: "Delivery", amountMinor: "3500000", currency: "NGN", status: "IN_PROGRESS", settlementMode: "PROVIDER_DISABLED" },
    }} open onCreateTerms={vi.fn()} onOpenChange={vi.fn()} />);
    expect(screen.getByRole("link", { name: /Open linked Deal workspace/ })).toHaveAttribute("href", "/app/deals/real-deal-1");
    expect(screen.queryByRole("button", { name: /Draft and submit locked terms/ })).not.toBeInTheDocument();
  });
  it("does not claim to hold real funds or provide a fake payment button", () => {
    render(<ChatDealRoom conversation={base} open onCreateTerms={vi.fn()} onOpenChange={vi.fn()} />);
    expect(screen.getByText(/Payments and real escrow are unavailable/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Pay now|Fund escrow|Release money/i })).not.toBeInTheDocument();
  });
});
