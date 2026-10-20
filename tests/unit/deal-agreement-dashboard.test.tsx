// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  currentUser: vi.fn(),
  getPrisma: vi.fn(),
  findMany: vi.fn(),
  getDealForUser: vi.fn(),
  redirect: vi.fn((path: string) => { throw new Error(`redirect:${path}`); }),
  notFound: vi.fn(() => { throw new Error("notFound"); }),
}));

vi.mock("@/lib/auth/session", () => ({ getCurrentUser: mocks.currentUser }));
vi.mock("@/lib/db/prisma", () => ({ getPrisma: mocks.getPrisma }));
vi.mock("@/lib/data/app", () => ({ getDealForUser: mocks.getDealForUser }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect, notFound: mocks.notFound }));

import AgreementDashboard from "@/app/app/escrow/page";
import DealAgreementTimeline from "@/app/app/deals/[dealId]/escrow/page";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.currentUser.mockResolvedValue({ id: "buyer-1" });
  mocks.findMany.mockResolvedValue([]);
  mocks.getPrisma.mockReturnValue({ deal: { findMany: mocks.findMany } });
});

describe("Deal agreement dashboard free-tier query and honest UX", () => {
  it("only requests the latest 30 authorized Deal records with minimal fields", async () => {
    const view = render(await AgreementDashboard());
    expect(mocks.findMany).toHaveBeenCalledTimes(1);
    const query = mocks.findMany.mock.calls[0][0];
    expect(query.take).toBe(30);
    expect(query.where.participants.some.userId).toBe("buyer-1");
    expect(query.select).toHaveProperty("status");
    expect(query.select).toHaveProperty("valueMinor");
    expect(query.select).toHaveProperty("proposal.select.opportunity.select.title", true);
    expect(query.include).toBeUndefined();
    expect(view.getByText(/no real escrow or funds held/i)).toBeInTheDocument();
    expect(view.getByText(/No agreement records yet/i)).toBeInTheDocument();
    expect(view.queryByText(/funds in escrow/i)).not.toBeInTheDocument();
  });

  it("never shows a real balance even when state machine says FUNDED", async () => {
    mocks.findMany.mockResolvedValue([{
      id: "deal-abc", status: "FUNDED", valueMinor: BigInt(3500000),
      currency: "NGN", updatedAt: new Date("2026-10-19T12:00:00.000Z"),
      proposal: { opportunity: { title: "Delivery service" } },
    }]);
    const view = render(await AgreementDashboard());
    expect(view.getByText(/funded · simulated/i)).toBeInTheDocument();
    expect(view.getByText(/Agreed value:/i)).toHaveTextContent(/not held/i);
    expect(view.getByRole("link", { name: "View state →" }).getAttribute("href"))
      .toBe("/app/deals/deal-abc/escrow");
  });

  it("refuses a signed-out viewer before touching the Deal database", async () => {
    mocks.currentUser.mockResolvedValue(null);
    await expect(AgreementDashboard()).rejects.toThrow("redirect:/sign-in");
    expect(mocks.findMany).not.toHaveBeenCalled();
  });
});

describe("Deal timeline is an agreement record, not an escrow fund ledger", () => {
  it("shows simulated status and chronological steps without a fake payment balance", async () => {
    mocks.getDealForUser.mockResolvedValue({
      id: "deal-abc", status: "RELEASED", valueMinor: BigInt(3500000),
      currency: "NGN",
      statusHistory: [
        { id: "history-1", toStatus: "SUBMITTED", reason: "Item marked submitted" },
        { id: "history-2", toStatus: "RELEASED", reason: "Simulation finished" },
      ],
    });
    const view = render(await DealAgreementTimeline({ params: Promise.resolve({ dealId: "deal-abc" }) }));
    expect(mocks.getDealForUser).toHaveBeenCalledWith("deal-abc", "buyer-1");
    expect(view.getByText("No funds held")).toBeInTheDocument();
    expect(view.getByText(/Do not send payment based on a status shown here/i)).toBeInTheDocument();
    expect(view.getByText("Item marked submitted")).toBeInTheDocument();
    expect(view.getByText("Simulation finished")).toBeInTheDocument();
  });
  it("does not disclose the timeline for an unauthorized Deal", async () => {
    mocks.getDealForUser.mockResolvedValue(null);
    await expect(DealAgreementTimeline({ params: Promise.resolve({ dealId: "private" }) }))
      .rejects.toThrow("notFound");
  });
});
