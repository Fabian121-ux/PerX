import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
const messages = readFileSync(join(process.cwd(), "src/components/messages/message-workspace.tsx"), "utf8");
const nudge = readFileSync(join(process.cwd(), "src/components/pwa/install-app-nudge.tsx"), "utf8");

function luminosity(hex: string) {
  const rgb = [1, 3, 5].map(i => Number.parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = rgb.map(x => x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4);
  return r * 0.2126 + g * 0.7152 + b * 0.0722;
}
function ratio(a: string, b: string) {
  const x = luminosity(a), y = luminosity(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

describe("fixed foreground/background pairs on mobile navy surfaces", () => {
  it("prevents selected Unread/All/Deals tabs from getting dark-on-dark in dark mode", () => {
    expect(messages).toContain('ptahx-navy-tab-active');
    expect(messages).toContain('ptahx-navy-tab-inactive');
    expect(css).toContain(".dark .ptahx-navy-tab-active");
    expect(css).toContain(".dark .ptahx-navy-tab-inactive");
    expect(css).toContain("background-color: #ffffff !important;");
    expect(css).toContain("color: #092554 !important;");
    expect(ratio("#092554", "#ffffff")).toBeGreaterThan(7);
    expect(ratio("#ffffff", "#294c7c")).toBeGreaterThan(7);
  });

  it("hides the floating button in chat, Deal and keyboard workflows", () => {
    expect(nudge).toContain('!pathname.startsWith("/app/messages")');
    expect(nudge).toContain('!pathname.startsWith("/app/deals")');
    expect(css).toContain(':root[data-ptahx-keyboard="open"] .ptahx-pwa-fab');
    expect(css).toContain('.ptahx-mobile-conversation-active .ptahx-pwa-fab');
  });
  it("routes @deal into the existing actual Deal room instead of sending command text", () => {
    expect(messages).toContain("isDealComposerTrigger(nextDraft)");
    expect(messages).toContain('setDealRoomOpen(true)');
    expect(messages).toContain("A command is never a normal sent message");
    expect(messages).toContain("<ChatDealRoom");
  });
});
