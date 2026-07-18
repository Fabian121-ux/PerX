/* eslint-disable @typescript-eslint/no-explicit-any */
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import {
  Bookmark,
  BriefcaseBusiness,
  CalendarDays,
  Flag,
  MapPin,
  Send,
  ShieldCheck,
} from "lucide-react";

import { PublicPageShell } from "@/components/standard-page";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/form";
import {
  bookmarkOpportunityAction,
  reportOpportunityAction,
} from "@/features/opportunities/actions";
import { submitProposalAction } from "@/features/proposals/actions";
import { getOpportunityBySlug } from "@/lib/data/opportunities";
import { getTemporaryOpportunityImage } from "@/lib/data/temporary-images";
import { formatBudgetRange } from "@/lib/money";

export default async function OpportunityDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const opportunity = await getOpportunityBySlug(slug);
  if (!opportunity) notFound();

  const image = getTemporaryOpportunityImage(opportunity.slug);
  const ownerName = opportunity.owner?.name ?? "perX member";
  const trustScore =
    opportunity.owner?.profile?.trustScore ?? opportunity.owner?.trustScore;

  return (
    <PublicPageShell>
      <main className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:px-8">
        <section className="min-w-0">
          <Card className="overflow-hidden p-0">
            <div className="relative h-56 overflow-hidden bg-[color:var(--px-muted)] sm:h-72">
              <Image
                alt={image.alt}
                className="object-cover"
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 820px"
                src={image.src}
              />
              <div className="absolute inset-0 bg-gradient-to-tr from-black/72 via-black/30 to-transparent" />
              <div className="absolute bottom-5 left-5 right-5">
                <div className="flex flex-wrap gap-2">
                  <Badge className="bg-white/90 capitalize text-[color:var(--px-text)]">
                    {opportunity.type.replaceAll("_", " ").toLowerCase()}
                  </Badge>
                  {opportunity.category ? (
                    <Badge className="bg-white/90 text-[color:var(--px-text)]">
                      {opportunity.category.name}
                    </Badge>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="p-5 sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <h1 className="text-3xl font-black leading-tight text-[color:var(--px-text)] sm:text-4xl">
                    {opportunity.title}
                  </h1>
                  <p className="mt-3 max-w-3xl text-base leading-7 text-[color:var(--px-text-muted)]">
                    {opportunity.summary}
                  </p>
                </div>
                <form action={bookmarkOpportunityAction} className="shrink-0">
                  <input
                    name="opportunityId"
                    type="hidden"
                    value={opportunity.id}
                  />
                  <Button type="submit" variant="secondary">
                    <Bookmark aria-hidden className="mr-2" size={16} />
                    Save
                  </Button>
                </form>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <Link
                  className="inline-flex items-center gap-2 rounded-full bg-[color:var(--px-surface-soft)] px-3 py-1.5 text-sm font-bold text-[color:var(--px-text)] hover:text-[color:var(--px-primary)]"
                  href={
                    opportunity.owner?.username
                      ? `/u/${opportunity.owner.username}`
                      : "/discover"
                  }
                >
                  {getInitials(ownerName)}
                  <span>{ownerName}</span>
                </Link>
                {trustScore ? (
                  <Badge className="border-green-200 bg-green-50 text-green-800">
                    <ShieldCheck aria-hidden className="mr-1" size={13} />
                    Trust {trustScore}
                  </Badge>
                ) : null}
              </div>
            </div>
          </Card>

          <div className="mt-6 grid gap-5 sm:grid-cols-3">
            <FactCard
              icon={<BriefcaseBusiness size={18} />}
              label="Compensation"
              value={formatBudgetRange(
                opportunity.budgetMinMinor,
                opportunity.budgetMaxMinor,
                opportunity.currency,
              )}
            />
            <FactCard
              icon={<MapPin size={18} />}
              label="Location"
              value={
                opportunity.remote
                  ? "Remote"
                  : opportunity.location ?? "Location set by owner"
              }
            />
            <FactCard
              icon={<CalendarDays size={18} />}
              label="Status"
              value="Open for proposals"
            />
          </div>

          <Card className="mt-6">
            <h2 className="text-xl font-black text-[color:var(--px-text)]">
              Opportunity details
            </h2>
            <p className="mt-4 whitespace-pre-line text-sm leading-7 text-[color:var(--px-text-muted)]">
              {opportunity.description}
            </p>
          </Card>

          <Card className="mt-6">
            <h2 className="text-xl font-black text-[color:var(--px-text)]">
              Skills and requirements
            </h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {(opportunity.skills ?? []).length ? (
                opportunity.skills.map((skill: any) => (
                  <Badge key={skill}>{skill}</Badge>
                ))
              ) : (
                <p className="text-sm text-[color:var(--px-text-muted)]">
                  Requirements will be clarified in the proposal conversation.
                </p>
              )}
            </div>
          </Card>
        </section>

        <aside className="grid gap-5 self-start lg:sticky lg:top-24">
          <Card>
            <h2 className="text-lg font-black text-[color:var(--px-text)]">
              Respond to this listing
            </h2>
            <p className="mt-2 text-sm leading-6 text-[color:var(--px-text-muted)]">
              Submit scope, amount, delivery period and acceptance details.
              perX beta does not collect or hold real funds.
            </p>
            <form action={submitProposalAction} className="mt-4 grid gap-4">
              <input
                name="opportunityId"
                type="hidden"
                value={opportunity.id}
              />
              <Field label="Proposed amount">
                <Input name="amount" placeholder="250000.00" required />
              </Field>
              <Field label="Delivery period">
                <Input min={1} name="deliveryDays" required type="number" />
              </Field>
              <Field label="Revisions">
                <Input
                  defaultValue={1}
                  min={0}
                  name="revisions"
                  required
                  type="number"
                />
              </Field>
              <Field label="Proposal">
                <Textarea
                  name="description"
                  placeholder="Scope, approach, milestones and acceptance criteria"
                  required
                />
              </Field>
              <Button type="submit">
                <Send aria-hidden className="mr-2" size={16} />
                Send proposal
              </Button>
              <ButtonLink href="/sign-in" variant="ghost">
                Sign in first if needed
              </ButtonLink>
            </form>
          </Card>

          <Card>
            <h2 className="text-lg font-black text-[color:var(--px-text)]">
              Trust and safety
            </h2>
            <div className="mt-4 grid gap-3">
              {[
                "Moderation reviewed listing",
                "Agreement workspace after acceptance",
                "Enquiry-based beta marketplace",
              ].map((item) => (
                <div
                  className="flex items-center gap-3 rounded-[var(--px-radius-sm)] bg-[color:var(--px-surface-soft)] p-3"
                  key={item}
                >
                  <ShieldCheck
                    className="text-[color:var(--px-success)]"
                    size={17}
                  />
                  <span className="text-sm font-semibold text-[color:var(--px-text-muted)]">
                    {item}
                  </span>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <h2 className="text-lg font-black text-[color:var(--px-text)]">
              Report listing
            </h2>
            <form action={reportOpportunityAction} className="mt-4 grid gap-3">
              <input
                name="opportunityId"
                type="hidden"
                value={opportunity.id}
              />
              <Input name="reason" placeholder="Reason" required />
              <Button type="submit" variant="secondary">
                <Flag aria-hidden className="mr-2" size={16} />
                Report
              </Button>
            </form>
          </Card>
        </aside>
      </main>
    </PublicPageShell>
  );
}

function FactCard({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <Card>
      <div className="flex items-center gap-3">
        <span className="perx-soft-tile grid h-10 w-10 place-items-center rounded-[var(--px-radius-sm)]">
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wide text-[color:var(--px-text-muted)]">
            {label}
          </p>
          <p className="mt-1 truncate text-sm font-black text-[color:var(--px-text)]">
            {value}
          </p>
        </div>
      </div>
    </Card>
  );
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
