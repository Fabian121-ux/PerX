"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type AdminNavigationLink = {
  href: string;
  label: string;
};

export type AdminNavigationGroup = {
  title: string;
  links: AdminNavigationLink[];
};

function isActivePath(pathname: string | null, href: string) {
  if (!pathname) return false;
  return href === "/admin"
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`);
}

function NavigationLinks({
  groups,
  pathname,
}: {
  groups: AdminNavigationGroup[];
  pathname: string | null;
}) {
  return (
    <div className="grid gap-5">
      {groups.map((group) => (
        <section aria-label={group.title} className="grid gap-1" key={group.title}>
          <h2 className="px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
            {group.title}
          </h2>
          <div className="grid gap-1">
            {group.links.map((link) => {
              const active = isActivePath(pathname, link.href);
              return (
                <Link
                  aria-current={active ? "page" : undefined}
                  className={[
                    "flex min-h-10 items-center rounded-xl px-3 py-2 text-sm font-semibold transition",
                    active
                      ? "bg-cyan-400/15 text-cyan-200 ring-1 ring-inset ring-cyan-300/20"
                      : "text-slate-300 hover:bg-white/8 hover:text-white",
                  ].join(" ")}
                  href={link.href}
                  key={link.href}
                >
                  <span
                    aria-hidden="true"
                    className={active ? "mr-2 h-1.5 w-1.5 rounded-full bg-cyan-300" : "mr-2 h-1.5 w-1.5 rounded-full bg-transparent"}
                  />
                  {link.label}
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

export function AdminNavigation({
  groups,
}: {
  groups: AdminNavigationGroup[];
}) {
  const pathname = usePathname();

  if (!groups.some((group) => group.links.length > 0)) return null;

  return (
    <>
      <aside className="sticky top-20 hidden self-start rounded-2xl border border-white/10 bg-slate-900/80 p-3 shadow-xl shadow-black/10 backdrop-blur lg:block">
        <nav aria-label="Admin navigation">
          <NavigationLinks groups={groups} pathname={pathname} />
        </nav>
      </aside>

      <details className="group rounded-2xl border border-white/10 bg-slate-900/90 p-3 shadow-lg shadow-black/10 lg:hidden">
        <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-2 text-sm font-bold text-white outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 [&::-webkit-details-marker]:hidden">
          <span>Admin navigation</span>
          <span
            aria-hidden="true"
            className="text-xs text-slate-400 transition group-open:rotate-180"
          >
            ▼
          </span>
        </summary>
        <nav aria-label="Admin navigation" className="mt-4 border-t border-white/10 pt-4">
          <NavigationLinks groups={groups} pathname={pathname} />
        </nav>
      </details>
    </>
  );
}
