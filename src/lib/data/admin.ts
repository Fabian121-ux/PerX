import { getPerXDataProvider } from "./provider";
import type { CursorPageParams } from "@/lib/data/cursor";
import type { AdminListKind } from "./providers/interfaces";

export async function getAdminMetrics() {
  const provider = await getPerXDataProvider();
  return provider.admin.getAdminMetrics();
}

export async function getAdminList(kind: AdminListKind) {
  const provider = await getPerXDataProvider();
  return provider.admin.getAdminList(kind);
}

export async function getAdminListPage(
  kind: AdminListKind,
  params?: CursorPageParams,
) {
  const provider = await getPerXDataProvider();
  return provider.admin.getAdminListPage(kind, params);
}
