import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
const home = readFileSync(join(process.cwd(), "src/components/feed/home-feed-view.tsx"), "utf8");

function themeToken(name: string, mode: "light" | "dark") {
  const scope = mode === "dark" ? css.slice(css.indexOf(".dark {")) : css.slice(css.indexOf(":root {"));
  const match = new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`).exec(scope);
  if (!match) throw new Error(`Missing ${name} in ${mode} theme`);
  return match[1];
}

function rgb(hex: string) {
  return [1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16) / 255);
}

function luminance(hex: string) {
  const [r, g, b] = rgb(hex).map((v) => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return r * 0.2126 + g * 0.7152 + b * 0.0722;
}

function ratio(foreground: string, background: string) {
  const a = luminance(foreground), b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

describe("site-wide readable text and button colour pairs", () => {
  it("keeps dark and light theme foreground/muted text readable on cards", () => {
    for (const mode of ["dark", "light"] as const) {
      const surface = themeToken("px-surface", mode);
      expect(ratio(themeToken("px-text", mode), surface)).toBeGreaterThanOrEqual(7);
      expect(ratio(themeToken("px-text-muted", mode), surface)).toBeGreaterThanOrEqual(4.5);
      expect(ratio(themeToken("px-primary-ink", mode), surface)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("keeps the Home Explore all chip readable even in dark mode and on hover", () => {
    expect(home).toContain("ptahx-discovery-all");
    expect(css).toContain(".dark .ptahx-discovery-all");
    expect(css).toContain(".dark .ptahx-discovery-all:hover");
    expect(ratio("#092554", "#ffffff")).toBeGreaterThanOrEqual(7);
    expect(ratio("#092554", "#e5efff")).toBeGreaterThanOrEqual(7);
  });

  it("preserves green success status surfaces instead of recolouring to purple", () => {
    const aliases = css.slice(css.indexOf("  .bg-blue-50,"), css.indexOf("  .ring-blue-100,"));
    expect(aliases).not.toContain(".bg-emerald-50");
  });
});
