import { describe, expect, it } from "vitest";

import { getAdminNavigationGroups } from "@/components/layout/admin-shell";

describe("admin navigation configuration", () => {
  it("groups operational destinations for an administrator", () => {
    const groups = getAdminNavigationGroups(["ADMIN"]);
    const links = groups.flatMap((group) => group.links);
    const hrefs = new Set(links.map((link) => link.href));

    expect(groups.map((group) => group.title)).toEqual([
      "Overview",
      "People & marketplace",
      "Trust & safety",
      "Administration",
    ]);
    expect(hrefs.has("/admin/users")).toBe(true);
    expect(hrefs.has("/admin/trader-applications")).toBe(true);
    expect(hrefs.has("/admin/moderation")).toBe(true);
    expect(hrefs.has("/admin/disputes")).toBe(true);
    expect(hrefs.has("/admin/audit")).toBe(true);
  });

  it("removes destinations outside the current capability set", () => {
    const groups = getAdminNavigationGroups(["INTERNAL_TESTER"]);
    expect(groups).toHaveLength(0);
  });
});
