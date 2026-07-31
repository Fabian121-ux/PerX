import { beforeEach, describe, expect, it, vi } from "vitest";

const redirect = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({ redirect }));

import LegacyConnectionRequestsPage from "@/app/app/connections/requests/page";
import LegacyNetworkPage from "@/app/app/network/page";
import {
  buildConnectionsPath,
  getLegacyNetworkDestination,
  normalizeConnectionsTab,
} from "@/features/network/routes";

describe("connection tab normalization", () => {
  it.each([
    [undefined, "discover"],
    ["discover", "discover"],
    ["suggestions", "discover"],
    ["people", "discover"],
    ["requests", "requests"],
    ["incoming", "requests"],
    ["sent-requests", "sent"],
    ["connections", "connections"],
    [["SENT", "discover"], "sent"],
    ["unknown", "discover"],
  ])("normalizes %j to %s", (value, expected) => {
    expect(normalizeConnectionsTab(value)).toBe(expected);
  });

  it("builds encoded canonical query-tab paths with bounded search text", () => {
    expect(buildConnectionsPath("discover", "  Ada & Bob  ")).toBe(
      "/app/connections?tab=discover&q=Ada+%26+Bob",
    );
    expect(buildConnectionsPath("sent", "x".repeat(100))).toBe(
      `/app/connections?tab=sent&q=${"x".repeat(80)}`,
    );
  });
});

describe("legacy connection route redirects", () => {
  beforeEach(() => {
    redirect.mockClear();
  });

  it("preserves the old Network default as My Connections", async () => {
    expect(getLegacyNetworkDestination({})).toBe(
      "/app/connections?tab=connections",
    );

    await LegacyNetworkPage({ searchParams: Promise.resolve({}) });

    expect(redirect).toHaveBeenCalledWith(
      "/app/connections?tab=connections",
    );
  });

  it("maps old suggestions to Discover People and retains q intent", async () => {
    await LegacyNetworkPage({
      searchParams: Promise.resolve({ q: "Ada & Bob", tab: "suggestions" }),
    });

    expect(redirect).toHaveBeenCalledWith(
      "/app/connections?tab=discover&q=Ada+%26+Bob",
    );
  });

  it("maps the nested requests route to the canonical request tab", async () => {
    await LegacyConnectionRequestsPage({
      searchParams: Promise.resolve({ q: "Mina" }),
    });

    expect(redirect).toHaveBeenCalledWith(
      "/app/connections?tab=requests&q=Mina",
    );
  });
});
