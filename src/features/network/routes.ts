export const connectionTabs = [
  "discover",
  "requests",
  "sent",
  "connections",
] as const;

export type ConnectionTab = (typeof connectionTabs)[number];
export type ConnectionSearchParam = string | string[] | undefined;

const tabAliases: Record<string, ConnectionTab> = {
  connections: "connections",
  discover: "discover",
  incoming: "requests",
  people: "discover",
  requests: "requests",
  sent: "sent",
  "sent-requests": "sent",
  suggestions: "discover",
};

function firstValue(value: ConnectionSearchParam) {
  return Array.isArray(value) ? value[0] : value;
}

export function normalizeConnectionsTab(
  value: ConnectionSearchParam,
): ConnectionTab {
  const normalized = firstValue(value)?.trim().toLowerCase();
  return (normalized && tabAliases[normalized]) || "discover";
}

export function buildConnectionsPath(
  tab: ConnectionTab,
  q?: ConnectionSearchParam,
) {
  const query = new URLSearchParams({ tab });
  const normalizedQ = firstValue(q)?.trim().slice(0, 80);
  if (normalizedQ) query.set("q", normalizedQ);
  return `/app/connections?${query.toString()}`;
}

export function getLegacyNetworkDestination(params: {
  q?: ConnectionSearchParam;
  tab?: ConnectionSearchParam;
}) {
  const legacyTab = firstValue(params.tab)?.trim().toLowerCase();
  const tab = legacyTab ? tabAliases[legacyTab] ?? "connections" : "connections";
  return buildConnectionsPath(tab, params.q);
}

export function getLegacyRequestsDestination(params: {
  q?: ConnectionSearchParam;
}) {
  return buildConnectionsPath("requests", params.q);
}
