import type { ReactNode } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { requireUser } from "@/lib/auth/session";
import { getUnreadCounts } from "@/lib/data/unread-counts";

export const dynamic = "force-dynamic";

export default async function AuthenticatedLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  const unreadCounts = await getUnreadCounts(user.id);
  return (
    <AppShell unreadCounts={unreadCounts} user={user}>
      {children}
    </AppShell>
  );
}
