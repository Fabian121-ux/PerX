import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getAppRoute } from "@/lib/navigation/app-routes";
import { getFeatureById, searchFeatures } from "@/lib/navigation/feature-registry";

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  getUserDealsPage: vi.fn(),
  getVerifiedShipmentForDeal: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ requireUser: mocks.requireUser }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/lib/data/app", () => ({ getUserDealsPage: mocks.getUserDealsPage }));
vi.mock("@/lib/tracking/shipment-provider", () => ({ getVerifiedShipmentForDeal: mocks.getVerifiedShipmentForDeal }));

import TrackingPage from "@/app/app/track/page";

describe("connected tracking centre", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue({ id: "user-alice" });
    mocks.getVerifiedShipmentForDeal.mockResolvedValue(null);
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
    expect(html).toContain("Your product agreements");
    expect(html).toContain("Open interactive map");
    expect(html).toContain("Shipping not confirmed");
    expect(html).not.toMatch(/live GPS|currently in transit|delivered to your home/i);
    expect(html).not.toContain("<iframe");
  });

  it("only requests carrier data for participant-authorized product agreements", async () => {
    const html = renderToStaticMarkup(await TrackingPage({
      searchParams: Promise.resolve({ deal: "unrelated-secret-deal" }),
    }));
    expect(mocks.getVerifiedShipmentForDeal).toHaveBeenCalledTimes(1);
    expect(mocks.getVerifiedShipmentForDeal).toHaveBeenCalledWith("deal-visible");
    expect(html).not.toContain("unrelated-secret-deal");
    expect(html).toContain("Selected for tracking");
  });

  it("automatically shows verified courier details for a selected product", async () => {
    mocks.getVerifiedShipmentForDeal.mockResolvedValue({
      dealId: "deal-visible",
      carrierName: "Example Courier",
      trackingNumber: "TEST-1234",
      status: "IN_TRANSIT",
      updatedAt: "2026-10-18T09:00:00Z",
      location: {
        source: "verified-carrier",
        carrierName: "Example Courier",
        latitude: 6.5244,
        longitude: 3.3792,
        observedAt: "2026-10-18T08:00:00Z",
      },
    });
    const html = renderToStaticMarkup(await TrackingPage({ searchParams: Promise.resolve({}) }));
    expect(html).toContain("TEST-1234");
    expect(html).toContain("Example Courier");
    expect(html).toContain("Verified event received");
    expect(html).toContain("Verified courier location available");
    expect(html).not.toContain("<iframe");
  });

  it("lets users select among their visible product agreements without another data query", async () => {
    mocks.getUserDealsPage.mockResolvedValue({
      items: [
        { id: "deal-visible", status: "IN_PROGRESS", proposal: { opportunity: { title: "First item", type: "PRODUCT" } }, statusHistory: [] },
        { id: "deal-second", status: "IN_PROGRESS", proposal: { opportunity: { title: "Second item", type: "PRODUCT" } }, statusHistory: [] },
      ],
      cursor: null,
      nextCursor: null,
    });
    const html = renderToStaticMarkup(await TrackingPage({ searchParams: Promise.resolve({ deal: "deal-second" }) }));
    expect(mocks.getVerifiedShipmentForDeal).toHaveBeenCalledWith("deal-second");
    expect(html).toContain("/app/track?deal=deal-visible");
    expect(html).toContain("Second item");
  });

  it("does not claim a parcel exists when no agreement exists", async () => {
    mocks.getUserDealsPage.mockResolvedValue({ items: [], cursor: null, nextCursor: null });
    const html = renderToStaticMarkup(await TrackingPage({ searchParams: Promise.resolve({}) }));
    expect(html).toContain("No agreements to track yet");
    expect(html).toContain("Enquiring about a product alone does not create an order");
    expect(html).toContain("/app/discover?type=PRODUCT");
  });
});
