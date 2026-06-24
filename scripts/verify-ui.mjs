import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const baseUrl = process.env.PREX_BASE_URL ?? "http://127.0.0.1:3000";
const outputDir = path.join(process.cwd(), "docs", "visual-verification");

const routes = [
  { name: "landing", path: "/" },
  { name: "discover", path: "/discover" },
  { name: "sign-in", path: "/sign-in" },
  { name: "sign-up", path: "/sign-up" },
  { name: "offline", path: "/offline" },
];

const viewports = [
  { label: "desktop", width: 1440, height: 1100 },
  { label: "mobile", width: 390, height: 844 },
];

async function validateManifest(page) {
  const response = await page.goto(`${baseUrl}/manifest.webmanifest`, { waitUntil: "networkidle" });
  if (!response?.ok()) {
    throw new Error(`Manifest request failed with ${response?.status()}`);
  }

  const manifest = JSON.parse(await page.locator("body").innerText());
  const requiredIcons = [
    "/icons/icon-192.png",
    "/icons/icon-512.png",
    "/icons/maskable-icon-192.png",
    "/icons/maskable-icon-512.png",
  ];

  if (manifest.name !== "perX" || manifest.short_name !== "perX") {
    throw new Error("Manifest name/short_name must be perX");
  }

  for (const src of requiredIcons) {
    if (!manifest.icons.some((icon) => icon.src === src)) {
      throw new Error(`Manifest is missing ${src}`);
    }
  }

  return manifest.icons.map((icon) => `${icon.src} ${icon.sizes} ${icon.purpose ?? "any"}`);
}

await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch();
const consoleErrors = [];

try {
  const manifestPage = await browser.newPage();
  const manifestIcons = await validateManifest(manifestPage);
  await manifestPage.close();

  for (const viewport of viewports) {
    const page = await browser.newPage({ viewport });
    page.on("console", (message) => {
      if (message.type() === "error") {
        consoleErrors.push(`${viewport.label}: ${message.text()}`);
      }
    });

    for (const route of routes) {
      const url = `${baseUrl}${route.path}`;
      const response = await page.goto(url, { waitUntil: "networkidle" });
      if (!response?.ok()) {
        throw new Error(`${route.path} failed with ${response?.status()}`);
      }
      await page.screenshot({
        fullPage: true,
        path: path.join(outputDir, `${route.name}-${viewport.label}.png`),
      });
    }

    await page.close();
  }

  console.log(JSON.stringify({ consoleErrors, manifestIcons, outputDir }, null, 2));
  if (consoleErrors.length) {
    process.exitCode = 1;
  }
} finally {
  await browser.close();
}
