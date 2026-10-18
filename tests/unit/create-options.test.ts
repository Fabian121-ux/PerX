import { describe, expect, it } from "vitest";

import { createOptions } from "@/lib/navigation/create-options";
import { getAppRoute } from "@/lib/navigation/app-routes";

describe("unified Create choices", () => {
  it("gives every member an existing community post route", () => {
    expect(createOptions[0]).toMatchObject({
      commercial: false,
      href: "/app/posts/new",
      label: "Share an update",
    });
    expect(getAppRoute("create_post")).toBe("/app/create");
  });

  it("keeps commercial listings on their existing trader-gated composer", () => {
    const commercial = createOptions.filter((option) => option.commercial);
    expect(commercial).toHaveLength(5);
    for (const item of commercial) {
      expect(item.href).toMatch(/^\/app\/opportunities\/new\?type=/);
    }
    expect(commercial.some((item) => item.href.includes("type=PRODUCT"))).toBe(true);
  });

  it("does not send preview Create to the authenticated app", () => {
    expect(getAppRoute("create_post", "preview")).toBe("/preview/opportunities/new");
  });
});
