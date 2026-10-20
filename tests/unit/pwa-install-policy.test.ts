import { describe, expect, it } from "vitest";
import {
  INSTALL_REMINDER_MS,
  isAndroidBrowser,
  isIOSBrowser,
  isInstallNudgeHome,
  isStandaloneApp,
  parseLastInstallSuggestion,
  shouldAutoSuggestInstall,
} from "@/lib/pwa/install-policy";

const now = 1_800_000_000_000;
const valid = {
  isInstalled: false, isOnline: true, isEligible: true,
  isHomeScreen: true, isVisible: true, lastShownAt: null, now,
};

describe("PWA install reminder frequency and platform policy", () => {
  it("shows once to an eligible first-time visitor", () => {
    expect(shouldAutoSuggestInstall(valid)).toBe(true);
  });
  it("never interrupts users with an already-installed PWA", () => {
    expect(shouldAutoSuggestInstall({ ...valid, isInstalled: true })).toBe(false);
    expect(isStandaloneApp({ displayModeStandalone: true })).toBe(true);
    expect(isStandaloneApp({ displayModeStandalone: false, navigatorStandalone: true })).toBe(true);
  });
  it("enforces a seven-day auto-popup cooldown", () => {
    expect(shouldAutoSuggestInstall({ ...valid, lastShownAt: now - INSTALL_REMINDER_MS + 1 })).toBe(false);
    expect(shouldAutoSuggestInstall({ ...valid, lastShownAt: now - INSTALL_REMINDER_MS })).toBe(true);
    expect(shouldAutoSuggestInstall({ ...valid, lastShownAt: now + 9999 })).toBe(false);
  });
  it("does not show while chatting, offline, hidden, or ineligible", () => {
    expect(shouldAutoSuggestInstall({ ...valid, isHomeScreen: false })).toBe(false);
    expect(shouldAutoSuggestInstall({ ...valid, isOnline: false })).toBe(false);
    expect(shouldAutoSuggestInstall({ ...valid, isVisible: false })).toBe(false);
    expect(shouldAutoSuggestInstall({ ...valid, isEligible: false })).toBe(false);
    expect(isInstallNudgeHome("/app/messages")).toBe(false);
    expect(isInstallNudgeHome("/app/deals/abc")).toBe(false);
    expect(isInstallNudgeHome("/app")).toBe(true);
  });
  it("recognizes iOS manual installation and Android browser support", () => {
    expect(isIOSBrowser("Mozilla iPhone OS 19_0")).toBe(true);
    expect(isIOSBrowser("Macintosh Safari", 5)).toBe(true);
    expect(isIOSBrowser("Chrome on Windows")).toBe(false);
    expect(isAndroidBrowser("Mozilla Android 16 Chrome")).toBe(true);
  });
  it("does not trust invalid persisted reminder timestamps", () => {
    expect(parseLastInstallSuggestion(null)).toBeNull();
    expect(parseLastInstallSuggestion("bad")).toBeNull();
    expect(parseLastInstallSuggestion("-100")).toBeNull();
    expect(parseLastInstallSuggestion("123456")).toBe(123456);
  });
});
