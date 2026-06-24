import Link from "next/link";
import type { ReactNode } from "react";

import { BrandLogo } from "@/components/brand-logo";
import { signOutAction } from "@/features/auth/actions";
import type { CurrentUser } from "@/lib/auth/session";

const adminLinks = [
  ["/admin", "Dashboard"],
  ["/admin/users", "Users"],
  ["/admin/profiles", "Profiles"],
  ["/admin/opportunities", "Opportunities"],
  ["/admin/reports", "Reports"],
  ["/admin/reviews", "Reviews"],
  ["/admin/disputes", "Disputes"],
  ["/admin/verification", "Verification"],
  ["/admin/audit-logs", "Audit logs"],
  ["/admin/activity", "Activity"],
  ["/admin/moderation", "Moderation"],
];

export function AdminShell({ children }: { children: ReactNode; user: CurrentUser }) {
  return (
    <div className="min-h-dvh bg-slate-950 text-white">
      <header className="border-b border-white/10 bg-slate-950">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link className="inline-flex items-center gap-3" href="/admin" aria-label="perX admin">
            <BrandLogo className="h-10" dark />
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-white/80">Admin</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link className="text-sm font-medium text-slate-300 hover:text-white" href="/app">
              User app
            </Link>
            <form action={signOutAction}>
              <button className="rounded-[var(--px-radius-sm)] border border-white/15 px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-white/10" type="submit">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[240px_1fr] lg:px-8">
        <aside className="rounded-[24px] border border-white/10 bg-white/5 p-3 shadow-[var(--px-shadow-strong)] lg:sticky lg:top-20 lg:self-start">
          <nav className="grid gap-1">
            {adminLinks.map(([href, label]) => (
              <Link className="rounded-[var(--px-radius-sm)] px-3 py-2 text-sm font-semibold text-slate-300 hover:bg-white/10 hover:text-white" href={href} key={href}>
                {label}
              </Link>
            ))}
          </nav>
        </aside>
        <main>{children}</main>
      </div>
    </div>
  );
}
