import { chromium } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
const viewports = [375, 430, 768, 1024, 1280, 1440];
const routes = ["/", "/discover", "/sign-up", "/u/amara-okafor"];

if (process.env.PERX_ENABLE_PREVIEW === "true") {
  routes.push("/preview", "/preview/messages", "/preview/deals/demo-deal");
}

const browser = await chromium.launch({ headless: true });
const results = [];

try {
  const discoveryContext = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  const discoveryPage = await discoveryContext.newPage();
  await discoveryPage.goto(`${baseURL}/discover`, { waitUntil: "domcontentloaded" });
  const firstOpportunityHref = await discoveryPage
    .locator('a[href^="/opportunities/"]')
    .first()
    .getAttribute("href")
    .catch(() => null);
  await discoveryContext.close();

  if (firstOpportunityHref) {
    routes.push(firstOpportunityHref);
  }

  for (const route of routes) {
    for (const width of viewports) {
      const context = await browser.newContext({
        viewport: { width, height: 900 },
      });
      const page = await context.newPage();
      const consoleErrors = [];
      page.on("console", (message) => {
        if (message.type() === "error") {
          consoleErrors.push(message.text());
        }
      });
      page.on("pageerror", (error) => {
        consoleErrors.push(error.message);
      });

      const response = await page.goto(`${baseURL}${route}`, {
        waitUntil: "domcontentloaded",
        timeout: 30_000,
      });
      await page.waitForTimeout(500);

      const metrics = await page.evaluate(() => {
        const body = document.body;
        const html = document.documentElement;
        const overlay = Boolean(
          document.querySelector(
            "[data-nextjs-dialog], .vite-error-overlay, #webpack-dev-server-client-overlay",
          ),
        );

        return {
          bodyTextLength: body.innerText.trim().length,
          horizontalOverflow:
            Math.max(body.scrollWidth, html.scrollWidth) > window.innerWidth + 1,
          overlay,
          statusText: document.title,
        };
      });

      results.push({
        consoleErrors: consoleErrors.slice(0, 3),
        route,
        status: response?.status() ?? null,
        width,
        ...metrics,
      });

      await context.close();
    }
  }
} finally {
  await browser.close();
}

const failures = results.filter(
  (result) =>
    !result.status ||
    result.status >= 500 ||
    result.bodyTextLength === 0 ||
    result.horizontalOverflow ||
    result.overlay ||
    result.consoleErrors.length > 0,
);

console.log(JSON.stringify({ failures, results }, null, 2));

if (failures.length) {
  process.exitCode = 1;
}
