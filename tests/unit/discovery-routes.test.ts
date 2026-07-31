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

  it("canonicalizes legacy dashboard routes to Home", async () => {
    const redirects = await nextConfig.redirects!();

    expect(redirects).toEqual(
      expect.arrayContaining([
        { destination: "/app", permanent: true, source: "/dashboard" },
        {
          destination: "/app",
          permanent: true,
          source: "/app/dashboard",
        },
      ]),
    );
  });
});
