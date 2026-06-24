import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const baseUrl = process.env.PREX_BASE_URL ?? "http://127.0.0.1:3000";
const outputDir = path.join(process.cwd(), "docs", "visual-verification");
const url = `${baseUrl}/preview`;

const viewports = [
  { label: "1440", width: 1440, height: 1100 },
  { label: "1280", width: 1280, height: 1000 },
  { label: "1024", width: 1024, height: 900 },
  { label: "768", width: 768, height: 1024 },
  { label: "430", width: 430, height: 932 },
  { label: "390", width: 390, height: 844 },
  { label: "375", width: 375, height: 812 },
  { label: "320", width: 320, height: 740 },
];

async function openDashboard(page, collapsed = false) {
  await page.addInitScript((isCollapsed) => {
    window.localStorage.setItem("perx-sidebar-collapsed", String(isCollapsed));
  }, collapsed);
  const response = await page.goto(url, { waitUntil: "networkidle" });
  if (!response?.ok()) {
    throw new Error(`/preview failed with ${response?.status()}`);
  }
}

async function assertViewport(page, label) {
  const metrics = await page.evaluate(() => ({
    brandText: document.body.innerText,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));

  if (metrics.scrollWidth > metrics.clientWidth + 1) {
    throw new Error(`${label}: horizontal overflow ${metrics.scrollWidth} > ${metrics.clientWidth}`);
  }

  const staleBrandAndCurrency = ["pre" + "X", "Pre" + "X", "PER" + "X", "US" + "D", "US" + "$"];
  for (const forbidden of staleBrandAndCurrency) {
    if (metrics.brandText.includes(forbidden)) {
      throw new Error(`${label}: rendered dashboard still contains ${forbidden}`);
    }
  }
}

await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch();

try {
  const desktopExpanded = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  await openDashboard(desktopExpanded, false);
  await assertViewport(desktopExpanded, "desktop-expanded");
  await desktopExpanded.screenshot({
    fullPage: true,
    path: path.join(outputDir, "desktop-expanded-sidebar.png"),
  });
  await desktopExpanded.screenshot({
    fullPage: true,
    path: path.join(outputDir, "desktop-gold-black-dashboard.png"),
  });
  await desktopExpanded.close();

  const desktopCollapsed = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  await openDashboard(desktopCollapsed, true);
  await assertViewport(desktopCollapsed, "desktop-collapsed");
  await desktopCollapsed.screenshot({
    fullPage: true,
    path: path.join(outputDir, "desktop-collapsed-sidebar.png"),
  });
  await desktopCollapsed.close();

  for (const viewport of viewports) {
    const page = await browser.newPage({ viewport });
    await openDashboard(page, false);
    await assertViewport(page, viewport.label);

    if (viewport.width === 390) {
      await page.evaluate(() => {
        document.documentElement.style.scrollBehavior = "auto";
      });
      await page.screenshot({ path: path.join(outputDir, "mobile-dashboard-top.png") });
      await page.evaluate(() => {
        const height = document.scrollingElement?.scrollHeight ?? document.documentElement.scrollHeight;
        window.scrollTo(0, Math.round(height * 0.38));
      });
      await page.waitForTimeout(250);
      await page.screenshot({ path: path.join(outputDir, "mobile-dashboard-middle.png") });
      await page.evaluate(() => {
        const height = document.scrollingElement?.scrollHeight ?? document.documentElement.scrollHeight;
        window.scrollTo(0, height);
      });
      await page.waitForTimeout(250);
      await page.screenshot({ path: path.join(outputDir, "mobile-dashboard-bottom.png") });
    }

    if (viewport.width === 320) {
      await page.screenshot({ fullPage: true, path: path.join(outputDir, "mobile-320.png") });
    }

    await page.close();
  }

  console.log(JSON.stringify({ outputDir, verified: viewports.map((viewport) => viewport.label) }, null, 2));
} finally {
  await browser.close();
}
