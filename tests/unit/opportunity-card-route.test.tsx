import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/image", async () => {
  const React = await import("react");
  return {
    default: ({ alt, src }: { alt: string; src: string }) =>
      React.createElement("img", { alt, src }),
  };
});

vi.mock("next/link", async () => {
  const React = await import("react");
  return {
    default: ({
      children,
      href,
    }: {
      children: React.ReactNode;
      href: string;
    }) => React.createElement("a", { href }, children),
  };
});

vi.mock("@/features/opportunities/actions", () => ({
  bookmarkOpportunityAction: vi.fn(),
}));

import { OpportunityCard } from "@/components/opportunity-card";

describe("opportunity card destination", () => {
  it("opens the canonical public detail route by default", () => {
    const markup = renderToStaticMarkup(
      <OpportunityCard
        opportunity={{
          slug: "canonical-service",
          summary: "A database-backed service listing.",
          title: "Canonical service",
          type: "SERVICE",
        }}
      />,
    );

    expect(markup).toContain('href="/opportunities/canonical-service"');
    expect(markup).not.toContain("?opportunity=");
  });

  it("uses record-backed Trust evidence instead of legacy profile counters", () => {
    const markup = renderToStaticMarkup(
      <OpportunityCard
        opportunity={{
          owner: {
            emailVerifiedAt: new Date("2026-08-01T00:00:00.000Z"),
            name: "Record Owner",
            profile: {
              averageRating: 5,
              completedDeals: 99,
              profileCompleteness: 100,
            },
            trustRecordEvidence: {
              averageRating: 0,
              completedAgreements: 0,
              publicReviewCount: 0,
            },
            verificationStatus: "VERIFIED",
          },
          slug: "record-backed-service",
          summary: "A service with record-backed Trust evidence.",
          title: "Record-backed service",
          type: "SERVICE",
        }}
      />,
    );

    expect(markup).toContain("Building");
    expect(markup).not.toContain("Strong");
  });
});
