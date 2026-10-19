import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(join(process.cwd(),path),"utf8");

describe("visible app links and high contrast content", () => {
  it("uses theme-aware shared empty states and deal delivery headings", () => {
    const card = source("src/components/ui/card.tsx");
    const delivery = source("src/app/app/deals/[dealId]/deliveries/page.tsx");
    expect(card).toContain("text-[color:var(--px-text)]");
    expect(card).toContain("bg-[color:var(--px-surface-soft)]");
    expect(card).not.toContain("text-slate-950");
    expect(delivery).not.toContain("text-slate-950");
  });

  it("accepts Products on discover rather than silently ignoring the filter", () => {
    expect(source("src/app/app/discover/page.tsx")).toContain('"PRODUCT"');
    expect(source("src/components/feed/home-feed-view.tsx")).toContain('/app/discover?type=PRODUCT');
  });

  it("routes real actions to their existing features, not dead icons", () => {
    const header = source("src/components/dashboard/dashboard-topbar.tsx");
    const feed = source("src/components/feed/feed-post-card.tsx");
    expect(header).toContain('"/app/track"');
    expect(feed).toContain("targetType=OPPORTUNITY");
    expect(feed).toContain("View seller");
    expect(feed).toContain("#respond-to-listing");
  });
});
