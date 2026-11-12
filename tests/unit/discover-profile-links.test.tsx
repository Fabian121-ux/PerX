import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", async () => {
  const React = await import("react");
  return {
    default: ({
      children,
      href,
      ...props
    }: {
      children: React.ReactNode;
      href: string;
      [key: string]: unknown;
    }) => React.createElement("a", { ...props, href }, children),
  };
});

import { DiscoverExperience } from "@/components/discover/discover-experience";
import { calculateTrustSummary } from "@/lib/trust/engine";

describe("discovery profile navigation", () => {
  it("links both the people rail and the full profile identity to the member profile", () => {
    const profile = {
      headline: "Building a startup",
      name: "Ada Lovelace",
      role: "Founder",
      trust: calculateTrustSummary({
        emailVerifiedAt: new Date("2026-01-01T00:00:00.000Z"),
        profileCompleteness: 85,
        verificationStatus: "VERIFIED",
      }),
      username: "ada-lovelace",
    };

    const markup = renderToStaticMarkup(
      <DiscoverExperience
        basePath="/app/discover"
        categories={[]}
        mode="app"
        opportunities={[]}
        params={{ type: "PEOPLE" }}
        profiles={[profile]}
      />,
    );

    expect(markup.match(/href="\/u\/ada-lovelace"/g)).toHaveLength(3);
    expect(markup).toContain('aria-label="View Ada Lovelace profile"');
    expect(markup).toContain("View profile");
  });
});
