import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getAppRoute } from "@/lib/navigation/app-routes";
import { getFeatureById, searchFeatures } from "@/lib/navigation/feature-registry";

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  getUserDealsPage: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ requireUser: mocks.requireUser }));
vi.mock("@/lib/data/app", () => ({ getUserDealsPage: mocks.getUserDealsPage }));

import TrackingPage from "@/app/app/track/page";

describe("connected tracking centre", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue({ id: "user-alice" });
    mocks.getUserDealsPage.mockResolvedValue({
      cursor: null,
      nextCursor: null,
      items: [{
        id: "deal-visible",
        status: "IN_PROGRESS",
        proposal: { opportunity: { title: "Aba two-piece order agreement", type: "PRODUCT" } },
        statusHistory: [{
          id: "history-1",
          toStatus: "IN_PROGRESS",
          createdAt: new Date("2026-10-01T10:00:00Z"),
        }],
      }],
    });
  });

  it("registers one real tracking route and keeps preview in existing logistics page", () => {
    expect(getAppRoute("track")).toBe("/app/track");
    expect(getAppRoute("track", "preview")).toBe("/preview/logistics");
    expect(getFeatureById("tracking")).toMatchObject({
      href: "/app/track",
      label: "Track",
      showInSidebar: true,
    });
    expect(searchFeatures("shipment").map((item) => item.id)).toContain("tracking");
  });

  it("only loads records for the logged-in participant and links to existing workflows", async () => {
    const html = renderToStaticMarkup(await TrackingPage({ searchParams: Promise.resolve({}) }));
    expect(mocks.getUserDealsPage).toHaveBeenCalledWith("user-alice", { cursor: undefined, pageSize: 20 });
    expect(html).toContain("Aba two-piece order agreement");
    expect(html).toContain("/app/deals/deal-visible");
    expect(html).toContain("/app/deals/deal-visible/deliveries");
    expect(html).toContain("Current agreement state");
    expect(html).toContain("Location not available");
    expect(html).not.toMatch(/live GPS|currently in transit|delivered to your home/i);
    expect(html).not.toContain("<iframe");
  });

  it("does not claim a parcel exists when no agreement exists", async () => {
    mocks.getUserDealsPage.mockResolvedValue({ items: [], cursor: null, nextCursor: null });
    const html = renderToStaticMarkup(await TrackingPage({ searchParams: Promise.resolve({}) }));
    expect(html).toContain("No agreements to track yet");
    expect(html).toContain("Enquiring about a product alone does not create an order");
    expect(html).toContain("/app/market");
  });
});
