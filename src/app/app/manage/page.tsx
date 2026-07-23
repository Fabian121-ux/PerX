import { Archive, Copy, Eye, Pause, Pencil, Play, RotateCcw, Search, Trash2 } from "lucide-react";

import { AppSection } from "@/components/app-section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { Card, EmptyState } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/form";
import {
  archiveOpportunityAction,
  deleteOpportunityAction,
  duplicateOpportunityAction,
  pauseOpportunityAction,
  publishOpportunityAction,
  restoreOpportunityAction,
} from "@/features/opportunities/actions";
import { requireUser } from "@/lib/auth/session";
import { getPrisma } from "@/lib/db/prisma";
import { opportunityTypeOptions } from "@/lib/options";
import type { OpportunityStatus, OpportunityType } from "@/generated/prisma/enums";

export const dynamic = "force-dynamic";

const statusOptions = [
  { label: "All", value: "" },
  { label: "Drafts", value: "DRAFT" },
  { label: "Published", value: "PUBLISHED" },
  { label: "Paused", value: "PAUSED" },
  { label: "Archived", value: "ARCHIVED" },
  { label: "Closed", value: "CLOSED" },
];

export default async function ManageContentPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; type?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const q = params.q?.trim();
  const status = statusOptions.some((option) => option.value === params.status)
    ? (params.status as OpportunityStatus | "")
    : "";
  const type = opportunityTypeOptions.some((option) => option.value === params.type)
    ? (params.type as OpportunityType)
    : "";

  const opportunities = (await getPrisma().opportunity.findMany({
    include: {
      _count: { select: { bookmarks: true, proposals: true, reports: true } },
      category: true,
    },
    orderBy: { updatedAt: "desc" },
    take: 50,
    where: {
      ownerId: user.id,
      ...(status ? { status } : {}),
      ...(type ? { type } : {}),
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: "insensitive" } },
              { summary: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
  })) as unknown as Array<{
    _count: { bookmarks: number; proposals: number; reports: number };
    archivedAt: Date | null;
    category: { name: string; slug: string } | null;
    createdAt: Date;
    id: string;
    moderationStatus: string;
    slug: string;
    status: string;
    summary: string;
    title: string;
    type: string;
    updatedAt: Date;
  }>;

  return (
    <AppSection
      actions={<ButtonLink href="/app/opportunities/new">Create</ButtonLink>}
      description="Manage every opportunity, service, property, partnership, and startup listing you own."
      title="Manage my content"
    >
      <div className="grid gap-5">
        <Card>
          <form className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_180px_auto]">
            <label className="relative">
              <span className="sr-only">Search managed content</span>
              <Search
                aria-hidden
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--px-text-muted)]"
                size={17}
              />
              <Input
                className="pl-10"
                defaultValue={q}
                name="q"
                placeholder="Search your content"
              />
            </label>
            <label>
              <span className="sr-only">Status</span>
              <Select defaultValue={status} name="status">
                {statusOptions.map((option) => (
                  <option key={option.label} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </label>
            <label>
              <span className="sr-only">Content type</span>
              <Select defaultValue={type} name="type">
                <option value="">All content types</option>
                {opportunityTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </label>
            <Button type="submit" variant="secondary">
              Filter
            </Button>
          </form>
        </Card>

        {opportunities.length ? (
          <div className="grid gap-4">
            {opportunities.map((opportunity) => (
              <Card key={opportunity.id}>
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge>{opportunity.type.replaceAll("_", " ")}</Badge>
                      <Badge className={statusBadgeClass(opportunity.status)}>
                        {opportunity.status.replaceAll("_", " ")}
                      </Badge>
                      <Badge className="bg-[color:var(--px-surface-soft)] text-[color:var(--px-text-muted)]">
                        {opportunity.moderationStatus.replaceAll("_", " ")}
                      </Badge>
                    </div>
                    <h2 className="mt-2 truncate text-lg font-black text-[color:var(--px-text)]">
                      {opportunity.title}
                    </h2>
                    <p className="mt-1 line-clamp-2 text-sm leading-6 text-[color:var(--px-text-muted)]">
                      {opportunity.summary}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-3 text-xs font-semibold text-[color:var(--px-text-muted)]">
                      <span>Created {opportunity.createdAt.toLocaleDateString()}</span>
                      <span>Updated {opportunity.updatedAt.toLocaleDateString()}</span>
                      <span>{opportunity._count.proposals} proposal(s)</span>
                      <span>{opportunity._count.bookmarks} save(s)</span>
                      <span>{opportunity._count.reports} report(s)</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 lg:justify-end">
                    <ButtonLink
                      href={`/app/opportunities/${opportunity.id}`}
                      size="sm"
                      variant="secondary"
                    >
                      <Eye aria-hidden className="mr-1.5" size={14} />
                      Preview
                    </ButtonLink>
                    <ButtonLink
                      href={`/app/opportunities/${opportunity.id}/edit`}
                      size="sm"
                      variant="secondary"
                    >
                      <Pencil aria-hidden className="mr-1.5" size={14} />
                      Edit
                    </ButtonLink>
                    <StateActions id={opportunity.id} status={opportunity.status} />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState
            action={<ButtonLink href="/app/opportunities/new">Create opportunity</ButtonLink>}
            body="Drafts, published listings, paused items, and archived records you own will appear here."
            title="No managed content found"
          />
        )}
      </div>
    </AppSection>
  );
}

function StateActions({ id, status }: { id: string; status: string }) {
  return (
    <>
      {status !== "PUBLISHED" ? (
        <form action={async () => { "use server"; await publishOpportunityAction(id); }}>
          <Button size="sm" type="submit">
            <Play aria-hidden className="mr-1.5" size={14} />
            Publish
          </Button>
        </form>
      ) : (
        <form action={async () => { "use server"; await pauseOpportunityAction(id); }}>
          <Button size="sm" type="submit" variant="secondary">
            <Pause aria-hidden className="mr-1.5" size={14} />
            Pause
          </Button>
        </form>
      )}
      {status === "ARCHIVED" ? (
        <form action={async () => { "use server"; await restoreOpportunityAction(id); }}>
          <Button size="sm" type="submit" variant="secondary">
            <RotateCcw aria-hidden className="mr-1.5" size={14} />
            Restore
          </Button>
        </form>
      ) : (
        <form action={async () => { "use server"; await archiveOpportunityAction(id); }}>
          <Button size="sm" type="submit" variant="secondary">
            <Archive aria-hidden className="mr-1.5" size={14} />
            Archive
          </Button>
        </form>
      )}
      <form action={async () => { "use server"; await duplicateOpportunityAction(id); }}>
        <Button size="sm" type="submit" variant="secondary">
          <Copy aria-hidden className="mr-1.5" size={14} />
          Duplicate
        </Button>
      </form>
      {["DRAFT", "ARCHIVED"].includes(status) ? (
        <form action={async () => { "use server"; await deleteOpportunityAction(id); }}>
          <ConfirmSubmitButton message="Delete this item? This cannot be undone.">
            <Trash2 aria-hidden className="mr-1.5" size={14} />
            Delete
          </ConfirmSubmitButton>
        </form>
      ) : null}
    </>
  );
}

function statusBadgeClass(status: string) {
  if (status === "PUBLISHED") return "bg-emerald-50 text-emerald-800";
  if (status === "PAUSED") return "bg-amber-50 text-amber-800";
  if (status === "ARCHIVED") return "bg-slate-100 text-slate-700";
  if (status === "CLOSED") return "bg-red-50 text-red-700";
  return "bg-blue-50 text-blue-800";
}
