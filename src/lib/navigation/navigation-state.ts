export type ActivePathOptions = {
  aliases?: readonly string[];
  exact?: boolean;
};

function normalizePath(value: string) {
  const path = value.split(/[?#]/, 1)[0] || "/";

  if (path.length > 1 && path.endsWith("/")) {
    return path.slice(0, -1);
  }

  return path;
}

export function isNavigationItemActive(
  pathname: string,
  href: string,
  options: ActivePathOptions = {},
) {
  const currentPath = normalizePath(pathname);
  const destinations = [href, ...(options.aliases ?? [])].map(normalizePath);

  return destinations.some((destination) => {
    if (options.exact) return currentPath === destination;
    return (
      currentPath === destination || currentPath.startsWith(`${destination}/`)
    );
  });
}

export function formatNavigationBadge(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value) || value <= 0) return null;

  const count = Math.floor(value);
  if (count <= 0) return null;
  return count > 99 ? "99+" : String(count);
}

export function shouldShowNavigationDot(value: number | null | undefined) {
  return formatNavigationBadge(value) !== null;
}
