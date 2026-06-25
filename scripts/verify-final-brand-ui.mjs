import { chromium } from "@playwright/test";
import { mkdir, stat } from "node:fs/promises";
import { resolve } from "node:path";

const baseUrl = process.env.PERX_BASE_URL ?? "http://127.0.0.1:3000";
const outDir = resolve(process.cwd(), "docs/visual-verification/final-correction");

const desktop = { width: 1440, height: 1100 };
const mobile = { width: 390, height: 900 };

async function assertFile(path) {
  const info = await stat(path);
  if (info.size <= 0) {
    throw new Error(`Screenshot is empty: ${path}`);
  }
}

async function newPage(browser, { viewport = desktop, theme = "light", sidebarCollapsed } = {}) {
  const context = await browser.newContext({ deviceScaleFactor: 1, viewport });
  await context.addInitScript(({ selectedTheme, collapsed }) => {
    window.localStorage.setItem("theme", selectedTheme);
    if (typeof collapsed === "boolean") {
      window.localStorage.setItem("perx-sidebar-collapsed", String(collapsed));
    }
    const applyTheme = () => document.documentElement?.classList.toggle("dark", selectedTheme === "dark");
    applyTheme();
    window.addEventListener("DOMContentLoaded", applyTheme, { once: true });
  }, { selectedTheme: theme, collapsed: sidebarCollapsed });
  return context.newPage();
}

async function capture(browser, name, route, options = {}) {
  const page = await newPage(browser, options);
  const response = await page.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded" });
  if (response && response.status() >= 500) {
    throw new Error(`${route} returned HTTP ${response.status()}`);
  }
  await page.waitForLoadState("load", { timeout: 10000 }).catch(() => undefined);
  await page.waitForTimeout(900);
  const path = resolve(outDir, name);
  await page.screenshot({ fullPage: options.fullPage ?? true, path });
  await page.close();
  await assertFile(path);
}

async function captureClip(browser, name, route, clip, options = {}) {
  const page = await newPage(browser, options);
  await page.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("load", { timeout: 10000 }).catch(() => undefined);
  await page.waitForTimeout(900);
  const path = resolve(outDir, name);
  await page.screenshot({ clip, path });
  await page.close();
  await assertFile(path);
}

async function captureStatic(browser, name, html, viewport = { width: 900, height: 420 }) {
  const page = await browser.newPage({ viewport });
  await page.setContent(html, { waitUntil: "networkidle" });
  const path = resolve(outDir, name);
  await page.screenshot({ fullPage: true, path });
  await page.close();
  await assertFile(path);
}

async function validateManifest() {
  const response = await fetch(`${baseUrl}/manifest.webmanifest`);
  if (!response.ok) throw new Error(`Manifest returned HTTP ${response.status}`);
  const manifest = await response.json();
  if (manifest.name !== "perX" || manifest.short_name !== "perX") {
    throw new Error("Manifest name and short_name must be perX");
  }
  const requiredIcons = new Set([
    "/icons/icon-192.png",
    "/icons/icon-512.png",
    "/icons/maskable-icon-192.png",
    "/icons/maskable-icon-512.png",
  ]);
  for (const icon of manifest.icons ?? []) {
    requiredIcons.delete(icon.src);
  }
  if (requiredIcons.size) {
    throw new Error(`Manifest missing icons: ${Array.from(requiredIcons).join(", ")}`);
  }
}

async function assertNoHorizontalOverflow(browser) {
  const widths = [1440, 1280, 1024, 768, 430, 390, 375, 360, 320];
  const routes = ["/", "/discover", "/preview", "/preview/discover", "/preview/messages", "/preview/messages/demo-conversation", "/preview/deals/demo-deal", "/preview/admin"];

  for (const width of widths) {
    for (const route of routes) {
      const page = await newPage(browser, {
        theme: route === "/" ? "light" : "dark",
        viewport: { width, height: 920 },
      });
      await page.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("load", { timeout: 10000 }).catch(() => undefined);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      await page.close();
      if (overflow > 1) {
        throw new Error(`Horizontal overflow ${overflow}px at ${width}px on ${route}`);
      }
    }
  }
}

await mkdir(outDir, { recursive: true });
await validateManifest();

const browser = await chromium.launch();

await capture(browser, "landing-desktop-light.png", "/", { viewport: desktop, theme: "light" });
await capture(browser, "landing-desktop-dark.png", "/", { viewport: desktop, theme: "dark" });
await capture(browser, "landing-mobile-light.png", "/", { viewport: mobile, theme: "light" });
await capture(browser, "landing-mobile-dark.png", "/", { viewport: mobile, theme: "dark" });
await capture(browser, "sign-in-desktop.png", "/sign-in", { viewport: desktop, theme: "light" });
await capture(browser, "sign-in-mobile.png", "/sign-in", { viewport: mobile, theme: "light" });
await capture(browser, "dashboard-desktop.png", "/preview", { viewport: desktop, theme: "light", sidebarCollapsed: false });
await capture(browser, "dashboard-mobile.png", "/preview", { viewport: mobile, theme: "light" });
await capture(browser, "dashboard-dark-desktop.png", "/preview", { viewport: desktop, theme: "dark", sidebarCollapsed: false });
await capture(browser, "dashboard-dark-mobile.png", "/preview", { viewport: mobile, theme: "dark" });
await capture(browser, "expanded-sidebar.png", "/preview", { fullPage: false, viewport: desktop, theme: "dark", sidebarCollapsed: false });
await capture(browser, "collapsed-sidebar.png", "/preview", { fullPage: false, viewport: desktop, theme: "dark", sidebarCollapsed: true });
await captureClip(browser, "mobile-top-bar.png", "/preview", { x: 0, y: 0, width: mobile.width, height: 170 }, { viewport: mobile, theme: "dark" });
await captureClip(browser, "public-header.png", "/", { x: 0, y: 0, width: desktop.width, height: 120 }, { viewport: desktop, theme: "light" });
await capture(browser, "discover-desktop.png", "/preview/discover", { viewport: desktop, theme: "light" });
await capture(browser, "discover-mobile.png", "/preview/discover", { viewport: mobile, theme: "light" });
await capture(browser, "opportunity-detail.png", "/opportunities/secure-marketplace-dashboard", { viewport: desktop, theme: "light" });
await capture(browser, "messages-desktop.png", "/preview/messages", { viewport: desktop, theme: "dark" });
await capture(browser, "messages-mobile-list.png", "/preview/messages", { viewport: mobile, theme: "dark" });
await capture(browser, "messages-mobile-conversation-detail.png", "/preview/messages/demo-conversation", { viewport: mobile, theme: "dark" });
await capture(browser, "deal-workspace.png", "/preview/deals/demo-deal", { viewport: desktop, theme: "dark" });
await capture(browser, "admin-dashboard.png", "/preview/admin", { viewport: desktop, theme: "dark" });
await captureClip(browser, "fixed-header-scroll-state.png", "/preview", { x: 0, y: 0, width: desktop.width, height: 220 }, { viewport: desktop, theme: "light", sidebarCollapsed: false });

await captureStatic(
  browser,
  "logo-on-white.png",
  `<!doctype html><html><body style="margin:0;min-height:360px;display:grid;place-items:center;background:#f8fafc"><img src="${baseUrl}/brand/perx-logo-horizontal-light.png" alt="perX logo" style="width:360px;height:auto"/></body></html>`,
);
await captureStatic(
  browser,
  "logo-on-black.png",
  `<!doctype html><html><body style="margin:0;min-height:360px;display:grid;place-items:center;background:#061936"><img src="${baseUrl}/brand/perx-logo-horizontal-dark.png" alt="perX logo" style="width:360px;height:auto"/></body></html>`,
);
await captureStatic(
  browser,
  "favicon-browser-tab.png",
  `<!doctype html><html><body style="margin:0;background:#111318;font-family:Arial,sans-serif"><div style="height:220px;display:grid;place-items:center"><div style="display:flex;align-items:center;gap:12px;width:360px;border-radius:18px 18px 0 0;background:#f8fafc;padding:14px 18px;box-shadow:0 20px 60px rgba(0,0,0,.35)"><img src="${baseUrl}/icons/favicon-32x32.png" alt="" width="24" height="24"/><span style="color:#111318;font-weight:700">perX</span></div></div></body></html>`,
  { width: 520, height: 260 },
);
await captureStatic(
  browser,
  "pwa-icon-preview.png",
  `<!doctype html><html><body style="margin:0;background:#f3f6fb;font-family:Arial,sans-serif"><div style="min-height:420px;display:grid;place-items:center"><div style="display:flex;align-items:center;gap:28px"><img src="${baseUrl}/icons/icon-192.png" alt="perX 192 icon" width="144" height="144"/><img src="${baseUrl}/icons/maskable-icon-192.png" alt="perX maskable icon" width="144" height="144" style="border-radius:50%"/><img src="${baseUrl}/icons/icon-512.png" alt="perX 512 icon" width="144" height="144"/></div></div></body></html>`,
);

await assertNoHorizontalOverflow(browser);
await browser.close();

console.log(`Final brand UI screenshots written to ${outDir}`);
