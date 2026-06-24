"use client";

import Link from "next/link";
import { Briefcase, Building2, Grid, PlusCircle, Search, ShieldCheck } from "lucide-react";

import { usePathname } from "next/navigation";
import { getAppRoute, getEnvironment } from "@/lib/navigation/app-routes";
import { FeatureStatusDialog } from "@/components/shared/feature-status-dialog";

export function QuickActions() {
  const pathname = usePathname();
  const env = getEnvironment(pathname);
  const getHref = (key: Parameters<typeof getAppRoute>[0]) => getAppRoute(key, env);

  const actions = [
    { label: "Find Work", icon: Search, href: getHref("discover") },
    { label: "Post Opportunity", icon: PlusCircle, href: getHref("new_opportunity") },
    { label: "Find Co-founder", icon: Briefcase, href: `${getHref("discover")}?type=COFOUNDER` },
    { label: "Start a Deal", icon: ShieldCheck, href: "DIALOG" },
    { label: "Explore Startups", icon: Building2, href: "DIALOG" },
    { label: "More", icon: Grid, href: getHref("home") },
  ];

  return (
    <div className="rounded-[24px] bg-[color:var(--px-surface)] p-5 shadow-sm ring-1 ring-[color:var(--px-border)] transition-colors duration-200 sm:p-6">
      <div className="grid grid-cols-3 gap-4 sm:grid-cols-6">
        {actions.map((action, i) => {
          const content = (
            <div className="group flex min-h-[92px] flex-col items-center justify-center gap-3 rounded-[var(--px-radius-sm)] border border-transparent p-2 transition-colors hover:border-[color:var(--px-primary)]/35 hover:bg-[color:var(--px-surface-soft)]">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[color:var(--px-primary-soft)] text-[color:var(--px-gold-soft)] transition-transform group-hover:scale-105 group-hover:text-[color:var(--px-gold-bright)]">
                <action.icon size={23} />
              </div>
              <span className="text-center text-xs font-semibold text-[color:var(--px-text)]">{action.label}</span>
            </div>
          );

          if (action.href === "DIALOG") {
            return (
              <FeatureStatusDialog key={i} featureName={action.label}>
                <button className="w-full focus:outline-none" aria-label={action.label}>
                  {content}
                </button>
              </FeatureStatusDialog>
            );
          }

          return (
            <Link key={i} href={action.href} title={action.label}>
              {content}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
