import { test, expect } from "@playwright/test";

/**
 * Mobile layout checks for real error, gate and not-found surfaces.
 *
 * Error states are exactly where layout regressions hide: they are rarely
 * opened during manual testing, and a horizontally scrolling error page on a
 * 320px device is a dead end.
 *
 * These drive genuine server responses (unauthenticated gates and a real 404)
 * rather than rendering the component in isolation, so the assertions cover
 * the surface as users actually receive it.
 */

const BASE = process.env.PERF_BASE_URL ?? "http://127.0.0.1:3200";
const WIDTHS = [320, 360, 375, 390, 412, 430];

// Unauthenticated requests to gated routes, plus a genuine not-found.
const ROUTES = [
  { label: "auth gate (workspace)", path: "/app" },
  { label: "auth gate (trader)", path: "/app/trader" },
  { label: "not found", path: "/this-route-does-not-exist-perf" },
];

test.describe("mobile error and gate UX", () => {
  for (const width of WIDTHS) {
    test(`error and gate states fit at ${width}px`, async ({ browser }) => {
      const page = await browser.newPage({
        viewport: { height: 780, width },
      });
      try {
        for (const route of ROUTES) {
          await page.goto(`${BASE}${route.path}`, {
            waitUntil: "domcontentloaded",
          });

          const overflows = await page.evaluate(
            () => document.documentElement.scrollWidth > window.innerWidth + 1,
          );
          expect(
            overflows,
            `${route.label} scrolls sideways at ${width}px`,
          ).toBe(false);

          // At least one actionable control, sized for touch.
          const controls = page.locator("a:visible, button:visible");
          const count = await controls.count();
          expect(
            count,
            `${route.label} offers no action at ${width}px`,
          ).toBeGreaterThan(0);

          let tappable = 0;
          for (let i = 0; i < Math.min(count, 12); i += 1) {
            const box = await controls.nth(i).boundingBox();
            if (!box) continue;
            expect(
              box.x + box.width,
              `${route.label} control ${i} overflows at ${width}px`,
            ).toBeLessThanOrEqual(width + 1);
            if (box.height >= 40) tappable += 1;
          }
          expect(
            tappable,
            `${route.label} has no touch-sized action at ${width}px`,
          ).toBeGreaterThan(0);
        }
      } finally {
        await page.close();
      }
    });
  }
});
