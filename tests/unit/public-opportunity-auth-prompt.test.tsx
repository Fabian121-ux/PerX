// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getOpportunityBySlugResult: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/lib/data/opportunities", () => ({
  getOpportunityBySlugResult: mocks.getOpportunityBySlugResult,
}));
vi.mock("@/lib/data/temporary-images", () => ({
  getTemporaryOpportunityImage: () => ({
    src: "/test-listing.jpg", alt: "Office listing image",
  }),
}));
vi.mock("@/components/opportunities/listing-media-gallery", () => ({
  ListingMediaGallery: () => null,
}));
vi.mock("@/components/standard-page", () => ({
  PublicPageShell: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/features/opportunities/actions", () => ({
  bookmarkOpportunityAction: vi.fn(),
  reportOpportunityAction: vi.fn(),
}));
vi.mock("@/features/proposals/actions", () => ({
  saveProposalDraftAction: vi.fn(),
  submitProposalAction: vi.fn(),
}));

import OpportunityDetailPage from "@/app/(public)/opportunities/[slug]/page";

const opportunity = {
  id: "opp-1",
  slug: "service-and-delivery",
  title: "Service and delivery",
  summary: "I offer a delivery service",
  description: "Service delivery for clients",
  type: "SERVICE",
  skills: [],
  category: null,
  owner: null,
  images: [],
  currency: "NGN",
  budgetMinMinor: "10000000",
  budgetMaxMinor: "50000000",
  location: "Lagos",
  remote: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getOpportunityBySlugResult.mockResolvedValue({
    opportunity,
    unavailable: false,
  });
  mocks.getCurrentUser.mockResolvedValue(null);
});

describe("public listing visitor authentication", () => {
  it("does not ask an already signed-in member to sign in again", async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: "current-user", username: "dev_test" });

    const view = render(
      await OpportunityDetailPage({ params: Promise.resolve({ slug: opportunity.slug }) }),
    );

    expect(view.getByRole("heading", { name: opportunity.title })).toBeTruthy();
    expect(view.queryByRole("link", { name: /sign in to respond/i })).toBeNull();
    expect(view.queryByText(/sign in first if needed/i)).toBeNull();
    expect(view.getByRole("button", { name: "Submit locked version" })).toBeTruthy();
    expect(view.getByRole("button", { name: "Save draft" })).toBeTruthy();
  });

  it("offers guests sign-in and returns them to the current listing's response form", async () => {
    const view = render(
      await OpportunityDetailPage({ params: Promise.resolve({ slug: opportunity.slug }) }),
    );

    const link = view.getByRole("link", { name: "Sign in to respond" });
    expect(link.getAttribute("href")).toBe(
      "/sign-in?next=%2Fopportunities%2Fservice-and-delivery%23respond-to-listing",
    );
    expect(view.queryByText(/sign in first if needed/i)).toBeNull();
  });

  it("uses existing pending submit controls for save, proposals and report", async () => {
    const view = render(
      await OpportunityDetailPage({ params: Promise.resolve({ slug: opportunity.slug }) }),
    );

    for (const name of ["Save", "Save draft", "Submit locked version", "Report"]) {
      const button = view.getByRole("button", { name });
      expect(button.getAttribute("type")).toBe("submit");
    }
  });
});
