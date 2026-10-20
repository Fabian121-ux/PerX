/**
 * PtahX PWA install reminder policy.
 * No tracking cookies or server calls. Cooldown is device/browser-local.
 */
export const INSTALL_REMINDER_MS = 7 * 24 * 60 * 60 * 1_000;
export const INSTALL_INITIAL_DELAY_MS = 8_000;
export const INSTALL_STATE_KEY = "ptahx:pwa-install-nudge:v1";

export function isStandaloneApp(input: { displayModeStandalone: boolean; navigatorStandalone?: boolean }) {
  return input.displayModeStandalone || input.navigatorStandalone === true;
}

export function shouldAutoSuggestInstall(input: {
  isInstalled: boolean;
  isOnline: boolean;
  isEligible: boolean;
  isHomeScreen: boolean;
  isVisible: boolean;
  lastShownAt: number | null;
  now: number;
}) {
  if (input.isInstalled || !input.isOnline || !input.isEligible || !input.isHomeScreen || !input.isVisible) return false;
  if (!input.lastShownAt) return true;
  // A clock shifted backward must not spam people with another pop-up.
  if (input.lastShownAt > input.now) return false;
  return input.now - input.lastShownAt >= INSTALL_REMINDER_MS;
}

export function isInstallNudgeHome(pathname: string) {
  return pathname === "/" || pathname === "/app" || pathname === "/app/discover" || pathname === "/discover";
}

export function isIOSBrowser(userAgent: string, maxTouchPoints = 0) {
  return /iPad|iPhone|iPod/i.test(userAgent) ||
    (/Macintosh/i.test(userAgent) && maxTouchPoints > 1);
}

export function isAndroidBrowser(userAgent: string) {
  return /Android/i.test(userAgent);
}

export function parseLastInstallSuggestion(raw: string | null): number | null {
  if (raw === null) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}
