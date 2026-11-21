/** Normalize a human-typed username to a stable, URL-safe handle. */
export function normalizeUsernameInput(value: string) {
  return value.trim().replace(/\s+/g, "-").toLowerCase();
}
