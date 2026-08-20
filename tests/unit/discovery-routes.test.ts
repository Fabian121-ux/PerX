import { describe, expect, it } from "vitest";

import nextConfig from "../../next.config";
import { getCanonicalOpportunityPath } from "@/lib/data/opportunity-path";

describe("discovery route destinations", () => {
  it("builds the canonical public opportunity detail path", () => {
    expect(getCanonicalOpportunityPath("brand-design-service")).toBe(
      "/opportunities/brand-design-service",
    );
    expect(getCanonicalOpportunityPath("safe/value")).toBe(
      "/opportunities/safe%2Fvalue",
    );
  });

  it("does not redirect all public opportunity detail paths", async () => {
    const redirects = await nextConfig.redirects!();

    expect(redirects).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source: "/opportunities/:path*" }),
      ]),
    );
    expect(redirects).toEqual(
      expect.arrayContaining([
        {
          destination: "/app/opportunities",
          permanent: true,
          source: "/opportunities",
        },
      ]),
    );
  });

  it("sends legacy dashboard routes to Profile, which now owns personal activity", async () => {
    const redirects = await nextConfig.redirects!();

    expect(redirects).toEqual(
      expect.arrayContaining([
        { destination: "/app/profile", permanent: false, source: "/dashboard" },
        {
          destination: "/app/profile",
          permanent: false,
          source: "/app/dashboard",
        },
      ]),
    );
  });

  it("retires the Real Estate routes without breaking existing links", async () => {
    const redirects = await nextConfig.redirects!();

    // Not permanent: a 308 is cached indefinitely, and where retired-vertical
    // links should land is a product decision that may still change.
    expect(redirects).toEqual(
      expect.arrayContaining([
        {
          destination: "/app/discover",
          permanent: false,
          source: "/real-estate",
        },
        {
          destination: "/app/discover",
          permanent: false,
          source: "/app/real-estate",
        },
      ]),
    );
  });
});
