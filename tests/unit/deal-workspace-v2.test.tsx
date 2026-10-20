// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getDealForUser: vi.fn(),
  getConversationForUser: vi.fn(),
  getPaymentReadiness: vi.fn(),
  redirect: vi.fn((path: string) => { throw new Error(`redirect:${path}`); }),
  notFound: vi.fn(() => { throw new Error("notFound"); }),
}));

vi.mock("@/lib/auth/session", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/lib/data/app", () => ({
  getDealForUser: mocks.getDealForUser,
  getConversationForUser: mocks.getConversationForUser,
}));
vi.mock("@/lib/payments/service", () => ({ getPaymentReadiness: mocks.getPaymentReadiness }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect, notFound: mocks.notFound }));

import DealWorkspacePage from "@/app/app/deals/[dealId]/page";

const deal = {
  id: "deal-real-1",
  status: "IN_PROGRESS",
  settlementMode: "PROVIDER_DISABLED",
  valueMinor: BigInt(3_500_000),
  currency: "NGN",
  proposal: {
    conversationId: "chat-abc",
    opportunity: { title: "Delivery service", type: "SERVICE" },
  },
  proposalVersion: {
    versionNumber: 2,
    deliveryDays: 14,
    includedRevisions: 1,
    description: "Deliver the accepted order in two weeks",
  },
  participants: [
    { id: "p1", userId: "user-buyer", role: "buyer", user: { name: "Buyer", username: "buyer" } },
    { id: "p2", userId: "user-provider", role: "provider", user: { name: "Provider", username: "provider" } },
  ],
  milestones: [
    { id: "m1", title: "Send design", description: "First delivery", amountMinor: BigInt(1_500_000), currency: "NGN", status: "APPROVED" },
    { id: "m2", title: "Ship goods", description: "Next delivery", amountMinor: BigInt(2_000_000), currency: "NGN", status: "IN_PROGRESS" },
  ],
  statusHistory: [
    { id: "history-1", toStatus: "IN_PROGRESS", reason: "Agreement accepted", createdAt: new Date("2026-10-19T12:00:00.000Z") },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getCurrentUser.mockResolvedValue({ id: "user-provider" });
  mocks.getDealForUser.mockResolvedValue(deal);
  mocks.getConversationForUser.mockResolvedValue({ id: "chat-abc" });
  mocks.getPaymentReadiness.mockReturnValue({ available: false, message: "Online payments are not active." });
});

describe("participant-authorized Deal room", () => {
  const page = () => DealWorkspacePage({ params: Promise.resolve({ dealId: "deal-real-1" }) });

  it("shows actual milestone progress, immutable terms and safe discussion route", async () => {
    const view = render(await page());
    expect(mocks.getDealForUser).toHaveBeenCalledWith("deal-real-1", "user-provider");
    expect(mocks.getConversationForUser).toHaveBeenCalledWith("chat-abc", "user-provider");
    expect(view.getByRole("heading", { name: "Work progress" })).toBeInTheDocument();
    expect(view.getByRole("progressbar", { name: "Approved milestone progress" })).toHaveAttribute("aria-valuenow", "50");
    expect(view.getByText(/Terms v2 locked/i)).toBeInTheDocument();
    expect(view.getByText(/This is the accepted version/i)).toBeInTheDocument();
    expect(view.getByText("Deliver the accepted order in two weeks")).toBeInTheDocument();
    expect(view.getByRole("link", { name: /Open conversation/i })).toHaveAttribute("href", "/app/messages/chat-abc");
    expect(view.getByRole("link", { name: /Submit delivery/i })).toHaveAttribute("href", "/app/deals/deal-real-1/deliveries");
    expect(view.getByText(/not a wallet/i)).toBeInTheDocument();
  });

  it("does not link an inaccessible or removed chat", async () => {
    mocks.getConversationForUser.mockResolvedValue(null);
    const view = render(await page());
    expect(view.getByText(/No accessible linked conversation/i)).toBeInTheDocument();
    expect(view.queryByRole("link", { name: /Open conversation/i })).not.toBeInTheDocument();
  });

  it("does not fetch related conversation for a Deal that the viewer cannot access", async () => {
    mocks.getDealForUser.mockResolvedValue(null);
    await expect(page()).rejects.toThrow("notFound");
    expect(mocks.getConversationForUser).not.toHaveBeenCalled();
  });

  it("does not access Deal records for a signed-out user", async () => {
    mocks.getCurrentUser.mockResolvedValue(null);
    await expect(page()).rejects.toThrow("redirect:/sign-in");
    expect(mocks.getDealForUser).not.toHaveBeenCalled();
  });

  it("shows review action only to a buyer with a submitted milestone", async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: "user-buyer" });
    mocks.getDealForUser.mockResolvedValue({
      ...deal, status: "SUBMITTED",
      milestones: [{ ...deal.milestones[1], status: "SUBMITTED" }],
    });
    const view = render(await page());
    expect(view.getByRole("link", { name: "Review delivery" })).toHaveAttribute("href", "/app/deals/deal-real-1/deliveries");
    expect(view.queryByRole("link", { name: /Submit delivery/i })).not.toBeInTheDocument();
  });
});
