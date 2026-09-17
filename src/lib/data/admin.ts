import { getPtahXDataProvider } from "./provider";
import type { CursorPageParams } from "@/lib/data/cursor";
import type { AdminListKind } from "./providers/interfaces";

export async function getAdminMetrics() {
  const provider = await getPtahXDataProvider();
  return provider.admin.getAdminMetrics();
}

export async function getAdminUsersPage(params?: CursorPageParams) {
  const provider = await getPtahXDataProvider();
  return provider.admin.getAdminUsersPage(params);
}

export async function getAdminDealsPage(params?: CursorPageParams) {
  const provider = await getPtahXDataProvider();
  return provider.admin.getAdminDealsPage(params);
}

export async function getAdminList(kind: AdminListKind) {
  const provider = await getPtahXDataProvider();
  return provider.admin.getAdminList(kind);
}

export async function getAdminListPage(
  kind: AdminListKind,
  params?: CursorPageParams,
) {
  const provider = await getPtahXDataProvider();
  return provider.admin.getAdminListPage(kind, params);
}
