const authRoutes = new Set(["/password-recovery", "/sign-in", "/sign-up"]);

export function getSafeAuthRedirect(
  value: FormDataEntryValue | string | null | undefined,
  fallback = "/app",
) {
  const candidate = typeof value === "string" ? value.trim() : "";
  if (!candidate.startsWith("/") || candidate.startsWith("//")) return fallback;
  if (candidate.includes("://")) return fallback;

  try {
    const parsed = new URL(candidate, "https://perx.local");
    if (parsed.origin !== "https://perx.local") return fallback;
    if (authRoutes.has(parsed.pathname)) return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}
