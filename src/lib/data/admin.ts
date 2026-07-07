import { getPerXDataProvider } from "./provider";

export async function getAdminMetrics() {
  const provider = await getPerXDataProvider();
  return provider.admin.getAdminMetrics();
}

export async function getAdminList(kind: "users" | "profiles" | "opportunities" | "reports" | "reviews" | "disputes" | "verification" | "audit") {
  const provider = await getPerXDataProvider();
  return provider.admin.getAdminList(kind);
}
