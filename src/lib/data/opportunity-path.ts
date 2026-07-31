export function getCanonicalOpportunityPath(slug: string) {
  return `/opportunities/${encodeURIComponent(slug)}`;
}
