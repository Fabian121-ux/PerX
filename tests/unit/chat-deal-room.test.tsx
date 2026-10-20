// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const listingsMocks = vi.hoisted(() => ({
  getListings: vi.fn(),
  linkListing: vi.fn(),
}));
vi.mock("@/features/proposals/conversation-listings", () => ({
  getChatDealListingsAction: listingsMocks.getListings,
  linkChatDealListingAction: listingsMocks.linkListing,
}));
beforeEach(() => { vi.clearAllMocks(); });
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
  it("finds an eligible listing and creates real proposal eligibility from an unlinked chat", async () => {
    const listing = {
      id: "cl01234567890123456789011",
      currency: "NGN",
      title: "Software development",
    };
    listingsMocks.getListings.mockResolvedValue({ listings: [listing] });
    listingsMocks.linkListing.mockResolvedValue({ success: true, listing });
    const onLinkedListing = vi.fn();
    render(
      <ChatDealRoom
        conversation={{ id: "cl01234567890123456789012", participantName: "Ada", messages: [] }}
        onCreateTerms={vi.fn()}
        onLinkedListing={onLinkedListing}
        onOpenChange={vi.fn()}
        open
      />,
    );

    expect(await screen.findByRole("button", { name: /Software development/ })).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Software development/ }));
    });
    await waitFor(() => expect(listingsMocks.linkListing).toHaveBeenCalledWith({
      conversationId: "cl01234567890123456789012",
      opportunityId: listing.id,
    }));
    await waitFor(() => expect(onLinkedListing).toHaveBeenCalledWith(listing));
  });

  it("does not open terms when the server refuses the listing link", async () => {
    const listing = { id: "cl01234567890123456789011", currency: "NGN", title: "Approved work" };
    listingsMocks.getListings.mockResolvedValue({ listings: [listing] });
    listingsMocks.linkListing.mockResolvedValue({ error: "Listing is no longer approved." });
    const onLinkedListing = vi.fn();
    render(
      <ChatDealRoom
        conversation={{ id: "cl01234567890123456789012", participantName: "Ada", messages: [] }}
        onCreateTerms={vi.fn()}
        onLinkedListing={onLinkedListing}
        onOpenChange={vi.fn()}
        open
      />,
    );
    await screen.findByRole("button", { name: /Approved work/ });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Approved work/ }));
    });
    expect(await screen.findByRole("alert")).toHaveTextContent("Listing is no longer approved.");
    expect(onLinkedListing).not.toHaveBeenCalled();
  });

  it("lets any normal chat open a Deal room and request a real eligible listing", () => {
    const onRequestListing = vi.fn();
    render(<ChatDealRoom
      conversation={{ id: "chat-no-listing", participantName: "Ada", messages: [], events: [] }}
      open
      onCreateTerms={vi.fn()}
      onRequestListing={onRequestListing}
      onOpenChange={vi.fn()}
    />);
    expect(screen.getByRole("dialog", { name: "Deal room" })).toBeInTheDocument();
    expect(screen.getByText(/You can start a Deal by choosing an approved, published listing/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Draft and submit locked terms/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Ask for a listing" }));
    expect(onRequestListing).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("link", { name: "Browse listings" })).toHaveAttribute("href", "/app/discover");
  });

});
