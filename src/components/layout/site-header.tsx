import Link from "next/link";

import { BrandLogo } from "@/components/brand-logo";
import { ButtonLink } from "@/components/ui/button";
import { MobileNav } from "@/components/layout/mobile-nav";
import { getCurrentUser } from "@/lib/auth/session";
import { AccountMenu } from "@/components/dashboard/account-menu";

const publicLinks = [
  { href: "/discover", label: "Discover" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/trust-safety", label: "Trust" },
  { href: "/help", label: "Help" },
];

export async function SiteHeader() {
  const user = await getCurrentUser();

  return (
    <header className="sticky top-0 z-30 border-b border-[color:var(--px-border)] bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-[4.5rem] max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <Link className="inline-flex items-center" href="/" aria-label="perX home">
          <BrandLogo className="h-11" />
        </Link>
        <nav className="hidden items-center gap-6 md:flex">
          {publicLinks.map((link) => (
            <Link className="text-sm font-semibold text-[color:var(--px-text-muted)] transition hover:text-[color:var(--px-primary)]" href={link.href} key={link.href}>
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-2 md:flex">
          {user ? (
            <>
              <ButtonLink href="/app" variant="ghost">Dashboard</ButtonLink>
              <AccountMenu user={user} />
            </>
          ) : (
            <>
              <ButtonLink href="/sign-in" variant="ghost">Sign in</ButtonLink>
              <ButtonLink href="/sign-up">Sign up</ButtonLink>
            </>
          )}
        </div>
        <div className="flex items-center gap-2 md:hidden">
          {user && <AccountMenu user={user} />}
          <MobileNav 
            links={user ? [...publicLinks, { href: "/app", label: "Dashboard" }] : [...publicLinks, { href: "/sign-in", label: "Sign in" }, { href: "/sign-up", label: "Sign up" }]} 
          />
        </div>
      </div>
    </header>
  );
}
