/**
 * Session-based dismissal for sponsored content cards.
 *
 * Dismissals are stored in `sessionStorage` keyed by sponsored content id so
 * that a dismissed card does not re-show during the same browser session. The
 * storage is never persisted across sessions (browsers clear sessionStorage on
 * tab close), and we never record impression or click telemetry — only the
 * ids the user actively chose to hide.
 */

const STORAGE_KEY = "perx:sponsored-dismissed";

function getStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function getDismissedSponsoredIds(): string[] {
  const storage = getStorage();
  if (!storage) return [];

  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (value): value is string => typeof value === "string" && value.length > 0,
    );
  } catch {
    return [];
  }
}

export function isSponsoredDismissed(id: string | null | undefined): boolean {
  if (typeof id !== "string" || !id) return false;
  return getDismissedSponsoredIds().includes(id);
}

export function dismissSponsored(id: string | null | undefined): void {
  if (typeof id !== "string" || !id) return;

  const storage = getStorage();
  if (!storage) return;

  const ids = getDismissedSponsoredIds();
  if (ids.includes(id)) return;
  ids.push(id);

  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // Quota or privacy-mode failures are expected; dismissal is best-effort.
  }
}

export function clearSponsoredDismissals(): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}