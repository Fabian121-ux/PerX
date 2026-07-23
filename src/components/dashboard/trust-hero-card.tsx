"use client";

import { ShieldCheck, Info } from "lucide-react";
import Link from "next/link";
import { getAppRoute, getEnvironment } from "@/lib/navigation/app-routes";
import { usePathname } from "next/navigation";

export function TrustHeroCard() {
  const pathname = usePathname();
  const env = getEnvironment(pathname);
  return (
    <div className="perx-hero-card relative overflow-hidden rounded-[24px] px-6 py-8 text-white shadow-lg ring-1 ring-[color:var(--px-border)] sm:px-8 sm:py-10">
      {/* Decorative background elements constrained to right/top */}
      <div className="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-white/20 blur-[60px] sm:-right-20 sm:-top-20 sm:h-64 sm:w-64" />
      <div className="absolute right-10 -bottom-10 h-32 w-32 rounded-full bg-[color:var(--px-secondary)]/20 blur-[50px] sm:right-20 sm:-bottom-20 sm:h-48 sm:w-48" />
      
      {/* Readability gradient */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#061936]/92 via-[#0b2556]/78 to-transparent" />

      <div className="relative z-10 max-w-lg">
        <h2 className="text-3xl font-black tracking-tight sm:text-4xl">
          Build trusted deals
        </h2>
        <p className="mt-4 text-base leading-relaxed text-blue-50 sm:text-lg">
          Connect, agree on milestones and complete opportunities with greater confidence through perX.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-4">
          <Link
            href={getAppRoute("discover", env)}
            className="inline-flex h-11 items-center justify-center rounded-[var(--px-radius-sm)] bg-[color:var(--px-primary)] px-6 text-sm font-bold text-white transition-colors hover:bg-[color:var(--px-primary-strong)] focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            Explore opportunities
          </Link>
          <Link
            className="inline-flex h-11 items-center justify-center rounded-[var(--px-radius-sm)] border border-[color:var(--px-border)] bg-[color:var(--px-surface-soft)] px-6 text-sm font-bold text-[color:var(--px-text)] transition-colors hover:bg-[color:var(--px-surface-elevated)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)]"
            href={getAppRoute("deals", env)}
          >
            How deals work
          </Link>
        </div>

        <div className="mt-8 flex items-center gap-2 text-sm font-medium text-blue-50">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[color:var(--px-success)] text-white">
            <ShieldCheck size={14} />
          </div>
          <span>Beta simulated deal-state structure</span>
          <span className="ml-1 text-blue-100" aria-label="More info" role="img">
            <Info size={14} />
          </span>
        </div>
      </div>
    </div>
  );
}
