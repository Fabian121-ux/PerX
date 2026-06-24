import { ArrowRight, BadgeCheck, BriefcaseBusiness, Handshake, MessageSquareText, Search, ShieldCheck, WalletCards } from "lucide-react";

import { SiteHeader } from "@/components/layout/site-header";
import { OpportunityCard } from "@/components/opportunity-card";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/form";
import { getOpportunityFeed } from "@/lib/data/opportunities";

export const dynamic = "force-dynamic";

export default function Home() {
  const pillars = [
    { icon: BadgeCheck, label: "Discover opportunities", text: "Find jobs and projects with structured scope, ownership, and moderation state." },
    { icon: Handshake, label: "Create deals", text: "Move from chat to proposals, accepted terms, milestones, and delivery records." },
    { icon: WalletCards, label: "Simulate escrow", text: "Track provider-independent funding, approvals, releases, refunds, and disputes." },
    { icon: ShieldCheck, label: "Build reputation", text: "Reviews and trust signals are tied to eligible completed deals." },
  ];

  return (
    <div className="min-h-dvh bg-slate-50">
      <SiteHeader />
      <main>
        <section className="overflow-hidden bg-white">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[1.02fr_.98fr] lg:px-8 lg:py-14">
            <div className="flex flex-col justify-center">
              <p className="text-sm font-semibold uppercase tracking-wide text-[color:var(--px-primary)]">Opportunity ecosystem</p>
              <h1 className="mt-4 max-w-4xl text-5xl font-black tracking-normal text-[color:var(--px-text)] sm:text-6xl">perX</h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-[color:var(--px-text-muted)]">
                A trusted flow for discovering opportunities, meeting people, negotiating proposals, managing deals and building reputation.
              </p>
              <form action="/discover" className="mt-8 grid gap-3 rounded-[var(--px-radius)] border border-[color:var(--px-border)] bg-white p-2 shadow-[var(--px-shadow-md)] sm:grid-cols-[1fr_auto]">
                <label className="sr-only" htmlFor="home-search">
                  Search opportunities
                </label>
                <Input id="home-search" name="q" placeholder="Search jobs, projects, skills, collaborators" />
                <Button className="hidden sm:inline-flex" type="submit">
                  <Search aria-hidden className="mr-2" size={17} />
                  Search
                </Button>
                <button className="prex-btn-primary inline-flex min-h-11 items-center justify-center rounded-[var(--px-radius-sm)] px-4 py-2 text-sm font-semibold sm:hidden" type="submit">
                  <Search aria-hidden className="mr-2" size={17} />
                  Search
                </button>
              </form>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <ButtonLink href="/discover">
                  Discover opportunities
                  <ArrowRight aria-hidden className="ml-2" size={18} />
                </ButtonLink>
                <ButtonLink href="/sign-up" variant="secondary">
                  Create account
                </ButtonLink>
              </div>
            </div>
            <div className="prex-hero-card rounded-[24px] p-4 shadow-[var(--px-shadow-xl)]">
              <div className="grid gap-4 rounded-[20px] border border-white/10 bg-white/8 p-4 backdrop-blur">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--px-gold)]">Live flow</p>
                    <h2 className="mt-1 text-xl font-bold">Opportunity workspace</h2>
                  </div>
                  <span className="rounded-full bg-green-400/20 px-3 py-1 text-xs font-bold text-green-100 ring-1 ring-green-300/30">Verified</span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    { icon: BriefcaseBusiness, label: "Open deals", value: "18" },
                    { icon: MessageSquareText, label: "Active chats", value: "42" },
                    { icon: WalletCards, label: "Escrow states", value: "12" },
                    { icon: ShieldCheck, label: "Trust checks", value: "96%" },
                  ].map((item) => (
                    <div className="rounded-[var(--px-radius)] bg-white p-4 text-[color:var(--px-text)] shadow-sm" key={item.label}>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-semibold text-[color:var(--px-text-muted)]">{item.label}</span>
                        <span className="prex-soft-tile grid h-9 w-9 place-items-center rounded-[var(--px-radius-sm)]">
                          <item.icon aria-hidden size={17} />
                        </span>
                      </div>
                      <p className="mt-3 text-3xl font-black">{item.value}</p>
                    </div>
                  ))}
                </div>
                <div className="rounded-[var(--px-radius)] bg-[#0b2453] p-4">
                  <p className="text-sm font-semibold text-white">Backbone</p>
                  <div className="mt-4 grid gap-2">
                    {["Users", "Opportunities", "Chat", "Proposals", "Deals", "Trust", "Escrow", "Reputation"].map((item, index) => (
                      <div className="flex items-center justify-between rounded-[var(--px-radius-sm)] bg-white/9 px-3 py-2" key={item}>
                        <span className="text-sm font-semibold">{item}</span>
                        <span className="font-mono text-xs text-[color:var(--px-gold)]">{String(index + 1).padStart(2, "0")}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
        <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {pillars.map((pillar) => (
              <Card key={pillar.label}>
                <span className="prex-soft-tile grid h-11 w-11 place-items-center rounded-[var(--px-radius-sm)]">
                  <pillar.icon aria-hidden size={22} />
                </span>
                <h2 className="mt-4 font-semibold text-[color:var(--px-text)]">{pillar.label}</h2>
                <p className="mt-2 text-sm leading-6 text-[color:var(--px-text-muted)]">{pillar.text}</p>
              </Card>
            ))}
          </div>
        </section>
        <FeaturedOpportunities />
      </main>
    </div>
  );
}

async function FeaturedOpportunities() {
  const opportunities = (await getOpportunityFeed()).slice(0, 2);

  return (
    <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-[color:var(--px-primary)]">Live marketplace</p>
          <h2 className="mt-2 text-3xl font-bold text-[color:var(--px-text)]">Featured opportunities</h2>
        </div>
        <ButtonLink href="/discover" variant="secondary">
          See all
        </ButtonLink>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        {opportunities.map((opportunity) => (
          <OpportunityCard key={opportunity.slug} opportunity={opportunity} />
        ))}
      </div>
    </section>
  );
}
