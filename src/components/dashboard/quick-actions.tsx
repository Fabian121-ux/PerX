"use client";

import Link from "next/link";
import {
  Building2,
  Handshake,
  PlusCircle,
  Search,
  ShoppingBag,
  UserRoundPlus,
  Wrench,
  Users
} from "lucide-react";

import { usePathname } from "next/navigation";
import { getAppRoute, getEnvironment } from "@/lib/navigation/app-routes";

export function QuickActions() {
  const pathname = usePathname();
  const env = getEnvironment(pathname);
  const getHref = (key: Parameters<typeof getAppRoute>[0]) =>
    getAppRoute(key, env);

  const actions = [
    { label: "Find Work", icon: Search, href: getHref("discover") },
    { label: "Offer a Skill", icon: UserRoundPlus, href: getHref("new_opportunity") + "?type=SERVICE" },
    {
      label: "Post an Opportunity",
      icon: PlusCircle,
      href: getHref("new_opportunity"),
    },
    {
      label: "Find People",
      icon: Users,
      href: "/app/network",
    },
    {
      label: "Register a Business",
      icon: Building2,
      href: `${getHref("discover")}?type=BUSINESS`,
    },
    {
      label: "Find a Partner",
      icon: Handshake,
      href: `${getHref("discover")}?type=PARTNERSHIP`,
    },
    {
      label: "List an Item",
      icon: ShoppingBag,
      href: getHref("new_opportunity") + "?type=MARKET",
    },
    {
      label: "Explore Services",
      icon: Wrench,
      href: "/app/services",
    },
  ];

  return (
    <div className="rounded-[24px] bg-[color:var(--px-surface)] p-5 shadow-sm ring-1 ring-[color:var(--px-border)] transition-colors duration-200 sm:p-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
        {actions.map((action, i) => (
            <Link key={i} href={action.href} title={action.label}>
              <div className="group flex min-h-[92px] flex-col items-center justify-center gap-3 rounded-[var(--px-radius-sm)] border border-transparent p-2 transition-colors hover:border-[color:var(--px-primary)]/35 hover:bg-[color:var(--px-surface-soft)]">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[color:var(--px-primary-soft)] text-[color:var(--px-primary)] transition-transform group-hover:scale-105 group-hover:text-[color:var(--px-primary-strong)]">
                  <action.icon size={23} />
                </div>
                <span className="text-center text-xs font-semibold text-[color:var(--px-text)]">
                  {action.label}
                </span>
              </div>
            </Link>
        ))}
      </div>
    </div>
  );
}
