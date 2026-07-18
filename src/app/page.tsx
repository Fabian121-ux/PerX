/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  ArrowRight,
  BadgeCheck,
  BriefcaseBusiness,
  Handshake,
  MessageSquareText,
  Search,
  ShieldCheck,
  Sparkles,
  WalletCards,
} from "lucide-react";

import { SiteHeader } from "@/components/layout/site-header";
import { OpportunityCard } from "@/components/opportunity-card";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/form";
import { getOpportunityFeed } from "@/lib/data/opportunities";

export const dynamic = "force-dynamic";

const pillars = [
  { icon: BadgeCheck, label: "Discover opportunities", text: "Search jobs, projects, collaborators, startups and partnerships through one professional graph." },
  { icon: MessageSquareText, label: "Move through trust", text: "Start with conversations, then move into structured proposals with clear ownership and terms." },
  { icon: WalletCards, label: "Create deal records", text: "Track milestones, delivery, approvals and simulated release-state readiness." },
  { icon: ShieldCheck, label: "Build reputation", text: "Reviews and trust signals are tied to completed eligible deals, not arbitrary badges." },
];

const categories = ["Product design", "Software", "Startup support", "Operations", "Marketing", "Partnerships", "Remote jobs", "Deal-state projects"];

const steps = [
  ["Discover", "Find opportunities and trusted people with filters that match your role."],
  ["Connect", "Open conversations around the opportunity, not scattered inbox noise."],
  ["Propose", "Turn intent into scope, price, milestones, revisions and decision history."],
  ["Deal", "Track delivery, approvals, simulated release states, reviews and reputation."],
];

export default function Home() {
  return (
    <div className="min-h-dvh bg-[color:var(--px-page)]">
      <SiteHeader />
      <main className="overflow-hidden">
        <section className="relative bg-[color:var(--px-surface)]">
          <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(420px,0.88fr)] lg:px-8 lg:py-16">
            <div className="flex flex-col justify-center">
              <p className="inline-flex w-fit items-center gap-2 rounded-full bg-[color:var(--px-primary-soft)] px-3 py-1 text-xs font-bold uppercase tracking-wide text-[color:var(--px-primary)] ring-1 ring-[color:var(--px-primary)]/20">
                <Sparkles aria-hidden size={14} />
                Building Trust. Enabling Value.
              </p>
              <h1 className="mt-5 max-w-4xl text-5xl font-black leading-[1.02] tracking-normal text-[color:var(--px-text)] sm:text-6xl">
                A global trust-based commerce ecosystem.
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-[color:var(--px-text-muted)]">
                Improve how value is exchanged across industries, markets and borders through trusted, transparent, accountable and reliable systems.
              </p>

              <form action="/discover" className="mt-8 grid gap-3 rounded-[22px] border border-[color:var(--px-border)] bg-[color:var(--px-surface)] p-2 shadow-[var(--px-shadow)] sm:grid-cols-[1fr_auto]">
                <label className="sr-only" htmlFor="home-search">
                  Search opportunities
                </label>
                <Input id="home-search" name="q" placeholder="Search opportunities, people and startups..." />
                <button className="perx-btn-primary inline-flex min-h-11 items-center justify-center rounded-[var(--px-radius-sm)] px-5 py-2 text-sm font-semibold" type="submit">
                  <Search aria-hidden className="mr-2" size={17} />
                  Search
                </button>
              </form>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <ButtonLink href="/discover">
                  Find opportunities
                  <ArrowRight aria-hidden className="ml-2" size={18} />
                </ButtonLink>
                <ButtonLink href="/sign-up" variant="secondary">
                  Post an opportunity
                </ButtonLink>
              </div>

              <div className="mt-7 flex flex-wrap gap-2">
                {categories.slice(0, 6).map((category) => (
                  <a
                    className="rounded-full border border-[color:var(--px-border)] bg-[color:var(--px-surface-soft)] px-3 py-1.5 text-xs font-semibold text-[color:var(--px-text-muted)] transition hover:border-[color:var(--px-primary)] hover:text-[color:var(--px-primary)]"
                    href={`/discover?q=${encodeURIComponent(category)}`}
                    key={category}
                  >
                    {category}
                  </a>
                ))}
              </div>
            </div>

            <div className="perx-card relative grid gap-4 overflow-hidden p-4">
              <div className="perx-hero-card rounded-[22px] p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-blue-100">Live opportunity flow</p>
                    <h2 className="mt-2 text-2xl font-black text-white">From discovery to reputation</h2>
                  </div>
                  <span className="rounded-full bg-white/14 px-3 py-1 text-xs font-bold text-white ring-1 ring-white/20">Verified path</span>
                </div>
                <div className="mt-6 grid gap-3">
                  {["Opportunity", "Conversation", "Proposal", "Deal", "Simulated state", "Review"].map((item, index) => (
                    <div className="flex items-center justify-between rounded-2xl bg-white/11 px-4 py-3 text-white ring-1 ring-white/14" key={item}>
                      <span className="text-sm font-bold">{item}</span>
                      <span className="rounded-full bg-white/15 px-2.5 py-1 font-mono text-xs">{String(index + 1).padStart(2, "0")}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  { icon: BriefcaseBusiness, label: "Find work", value: "Listings" },
                  { icon: Handshake, label: "Start with clarity", value: "Proposals" },
                  { icon: WalletCards, label: "Track delivery", value: "Agreements" },
                  { icon: ShieldCheck, label: "Build reputation", value: "Trust" },
                ].map((item) => (
                  <div className="rounded-[18px] bg-[color:var(--px-surface-soft)] p-4 ring-1 ring-[color:var(--px-border)]" key={item.label}>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-semibold text-[color:var(--px-text-muted)]">{item.label}</span>
                      <span className="perx-soft-tile grid h-9 w-9 place-items-center rounded-[var(--px-radius-sm)]">
                        <item.icon aria-hidden size={17} />
                      </span>
                    </div>
                    <p className="mt-3 text-lg font-black text-[color:var(--px-text)]">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-7xl gap-4 px-4 py-12 sm:px-6 lg:grid-cols-4 lg:px-8">
          {pillars.map((pillar) => (
            <Card key={pillar.label}>
              <span className="perx-soft-tile grid h-11 w-11 place-items-center rounded-[var(--px-radius-sm)]">
                <pillar.icon aria-hidden size={22} />
              </span>
              <h2 className="mt-4 font-semibold text-[color:var(--px-text)]">{pillar.label}</h2>
              <p className="mt-2 text-sm leading-6 text-[color:var(--px-text-muted)]">{pillar.text}</p>
            </Card>
          ))}
        </section>

        <section className="bg-[color:var(--px-surface)] py-12">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:px-8">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-[color:var(--px-primary)]">How perX works</p>
              <h2 className="mt-3 text-3xl font-black text-[color:var(--px-text)]">Built around the real workflow</h2>
              <p className="mt-3 text-sm leading-6 text-[color:var(--px-text-muted)]">
                perX keeps communication, proposal terms, deal milestones, simulated release states and reputation connected instead of scattering them across disconnected tools.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {steps.map(([title, text], index) => (
                <div className="rounded-[20px] border border-[color:var(--px-border)] bg-[color:var(--px-surface-soft)] p-5" key={title}>
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-[color:var(--px-primary)] text-sm font-black text-white">{index + 1}</span>
                  <h3 className="mt-4 font-bold text-[color:var(--px-text)]">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[color:var(--px-text-muted)]">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <FeaturedOpportunities />

        <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
          <div className="perx-hero-card grid gap-6 rounded-[28px] p-8 sm:p-10 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <p className="text-sm font-bold uppercase tracking-wide text-blue-100">Trust and deal workflow layer</p>
              <h2 className="mt-3 text-3xl font-black text-white">Create opportunity relationships that can mature into real deals.</h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-blue-50">
                Start with discovery, then use structured proposals, deal workspaces, milestone tracking and simulated release states. Payment and escrow functionality is not active during this beta, and no real funds are collected or held by perX.
              </p>
            </div>
            <ButtonLink href="/how-it-works" variant="secondary">
              See how it works
            </ButtonLink>
          </div>
        </section>
      </main>
      <footer className="border-t border-[color:var(--px-border)] bg-[color:var(--px-surface)] px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 text-sm text-[color:var(--px-text-muted)] sm:flex-row sm:items-center sm:justify-between">
          <p>perX connects opportunities, people, trust and structured deals.</p>
          <div className="flex gap-4">
            <a className="hover:text-[color:var(--px-primary)]" href="/privacy">Privacy</a>
            <a className="hover:text-[color:var(--px-primary)]" href="/terms">Terms</a>
            <a className="hover:text-[color:var(--px-primary)]" href="/help">Help</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

async function FeaturedOpportunities() {
  const opportunities = (await getOpportunityFeed()).slice(0, 3);

  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-[color:var(--px-primary)]">Live marketplace</p>
          <h2 className="mt-2 text-3xl font-bold text-[color:var(--px-text)]">Featured opportunities</h2>
        </div>
        <ButtonLink href="/discover" variant="secondary">
          See all
        </ButtonLink>
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        {opportunities.map((opportunity: any) => (
          <OpportunityCard key={opportunity.slug} opportunity={opportunity} />
        ))}
      </div>
    </section>
  );
}
