import { describe, expect, it } from "vitest";

import {
  authenticatedMobileNavigation,
  featureRegistry,
  getFeatureById,
  searchFeatures,
  secondaryNavigation,
} from "@/lib/navigation/feature-registry";
import {
  formatNavigationBadge,
  isNavigationItemActive,
  shouldShowNavigationDot,
} from "@/lib/navigation/navigation-state";
import { getAppRoute } from "@/lib/navigation/app-routes";

describe("feature registry", () => {
  it("keeps Home first and exposes a canonical destination", () => {
    expect(featureRegistry[0]).toMatchObject({
      href: "/app",
      id: "home",
      label: "Home",
    });
  });

  it("searches labels, descriptions, keywords, and status terms", () => {
    expect(
      searchFeatures("CONVERSATIONS").map((feature) => feature.id),
    ).toContain("messages");
    expect(
      searchFeatures("pending requests").map((feature) => feature.id),
    ).toContain("connections");
    expect(
      searchFeatures("transaction protection").map((feature) => feature.id),
    ).toEqual(["escrow"]);
  });

  it("describes unavailable Escrow protection without protection claims", () => {
    const escrow = getFeatureById("escrow");

    expect(escrow.label).toBe("Escrow");
    expect(escrow.description).toBe(
      "Transaction protection is not yet available and is being prepared.",
    );
    expect(escrow.description).not.toMatch(/funds? (are )?protected/i);
  });

  it("registers News and keeps personal Activity distinct", () => {
    expect(getFeatureById("news")).toMatchObject({
      href: "/app/news",
      label: "News",
      showInSidebar: true,
    });
    expect(getFeatureById("notifications")).toMatchObject({
      href: "/app/notifications",
      label: "Activity",
    });
  });

  it("only exposes role-restricted destinations to eligible users", () => {
    expect(searchFeatures("admin")).toEqual([]);
    expect(searchFeatures("admin", { roles: ["ADMIN"] })).toHaveLength(1);
  });
});

describe("navigation active state", () => {
  it("keeps Home exact and activates nested destinations", () => {
    expect(isNavigationItemActive("/app", "/app", { exact: true })).toBe(true);
    expect(
      isNavigationItemActive("/app/messages/thread-1", "/app/messages"),
    ).toBe(true);
    expect(
      isNavigationItemActive("/app/messages", "/app", { exact: true }),
    ).toBe(false);
  });

  it("supports canonical aliases and ignores query strings and trailing slashes", () => {
    const connections = getFeatureById("connections");

    expect(
      isNavigationItemActive("/app/network?tab=requests", connections.href, {
        aliases: connections.activePaths,
      }),
    ).toBe(true);
    expect(
      isNavigationItemActive("/app/messages/", "/app/messages?view=all"),
    ).toBe(true);
  });
});

describe("navigation badges", () => {
  it("hides empty counts and caps visible values at 99+", () => {
    expect(formatNavigationBadge(0)).toBeNull();
    expect(formatNavigationBadge(-1)).toBeNull();
    expect(formatNavigationBadge(Number.NaN)).toBeNull();
    expect(formatNavigationBadge(1)).toBe("1");
    expect(formatNavigationBadge(99)).toBe("99");
    expect(formatNavigationBadge(100)).toBe("99+");
  });

  it("shows a dot only for a positive count and never formats a number", () => {
    expect(shouldShowNavigationDot(undefined)).toBe(false);
    expect(shouldShowNavigationDot(0)).toBe(false);
    expect(shouldShowNavigationDot(-1)).toBe(false);
    expect(shouldShowNavigationDot(1)).toBe(true);
    expect(shouldShowNavigationDot(100)).toBe(true);
  });
});

describe("authenticated navigation destinations", () => {
  it("uses exactly the required five mobile destinations in order", () => {
    const destinations = authenticatedMobileNavigation.map((item) => {
      const feature = getFeatureById(item.featureId);
      return { href: feature.href, label: item.label ?? feature.label };
    });

    // Home leads because the authenticated experience is feed-first, and
    // Create sits in the centre as the prominent action.
    expect(destinations).toEqual([
      { href: "/app", label: "Home" },
      { href: "/app/connections", label: "Network" },
      { href: "/app/opportunities/new", label: "Create" },
      { href: "/app/messages", label: "Messages" },
      { href: "/app/profile", label: "Profile" },
    ]);
    expect(authenticatedMobileNavigation[2]).toMatchObject({
      featureId: "create-post",
      prominent: true,
    });
  });

  it("keeps the mobile Network tab highlighted across its discovery surfaces", () => {
    const network = authenticatedMobileNavigation.find(
      (item) => item.featureId === "connections",
    );
    const feature = getFeatureById("connections");
    const aliases = [
      ...(feature.activePaths ?? []),
      ...(network && "activePaths" in network ? network.activePaths : []),
    ];

    for (const pathname of [
      "/app/connections",
      "/app/discover",
      "/app/network",
      "/app/people",
    ]) {
      expect(
        isNavigationItemActive(pathname, feature.href, { aliases }),
      ).toBe(true);
    }

    // Must not bleed into unrelated destinations.
    expect(isNavigationItemActive("/app/messages", feature.href, { aliases })).toBe(
      false,
    );
  });

  it("keeps the secondary menu focused instead of duplicating primary navigation", () => {
    const destinations = secondaryNavigation.map((item) => ({
      href: getFeatureById(item.featureId).href,
      label: item.label,
    }));

    expect(destinations).toEqual([
      { href: "/app/profile", label: "Account" },
      { href: "/app/news", label: "News" },
      { href: "/app/service-center", label: "Support" },
      { href: "/app/settings", label: "Settings" },
    ]);
  });

  it("uses the unified search destination for authenticated search", () => {
    expect(getAppRoute("search")).toBe("/app/search");
  });
});
