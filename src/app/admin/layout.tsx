import type { ReactNode } from "react";

import { AdminShell } from "@/components/layout/admin-shell";
import { requireCapabilityOrNotFound } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await requireCapabilityOrNotFound("admin:access");
  return <AdminShell user={user}>{children}</AdminShell>;
}
