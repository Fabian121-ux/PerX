/* eslint-disable @typescript-eslint/no-explicit-any */
import { AppSection } from "@/components/app-section";
import { CursorPagination } from "@/components/cursor-pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/card";
import { Textarea } from "@/components/ui/form";
import {
  acceptProposalAction,
  raiseProposalObjectionAction,
  rejectProposalAction,
} from "@/features/proposals/actions";
import { getCurrentUser } from "@/lib/auth/session";
import { getUserProposalsPage } from "@/lib/data/app";
import { formatMoney } from "@/lib/money";

export default async function ProposalsReceivedPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  const user = await getCurrentUser();
  const params = await searchParams;
  const page = await getUserProposalsPage(user!.id, "received", {
    cursor: params.cursor,
    pageSize: 20,
  });
  const proposals = page.items;

  return (
    <AppSection
      description="Review exact submitted versions. Accept, reject, or record an objection; ordinary chat messages never count as acceptance."
      title="Proposals received"
    >
      <div className="mb-5 rounded-2xl border border-amber-300/60 bg-amber-50 p-4 text-sm leading-6 text-amber-950 dark:border-amber-300/20 dark:bg-amber-950/20 dark:text-amber-100">
        Accepting creates a Deal record from the selected locked version. Online payment and escrow custody are not active; no funds are collected or held.
      </div>
      {proposals.length ? (
        <div className="grid gap-5">
          {proposals.map((proposal: any) => {
            const submittedVersion = proposal.versions.find(
              (version: any) => version.status === "SUBMITTED",
            );
            const displayedVersion = submittedVersion ?? proposal.versions[0];

            return (
              <Card key={proposal.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[color:var(--px-text-muted)]">
                      From {proposal.sender.name}
                    </p>
                    <h2 className="mt-1 text-lg font-black text-[color:var(--px-text)]">
                      {proposal.opportunity.title}
                    </h2>
                  </div>
                  <Badge>{formatStatus(proposal.status)}</Badge>
                </div>

                {displayedVersion ? (
                  <article className="mt-4 rounded-2xl border border-[color:var(--px-border)] bg-[color:var(--px-surface-soft)] p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-black text-[color:var(--px-primary)]">
                        Version {displayedVersion.versionNumber} · {formatStatus(displayedVersion.status)}
                      </p>
                      <p className="text-lg font-black text-[color:var(--px-text)]">
                        {formatMoney(displayedVersion.amountMinor, displayedVersion.currency)}
                      </p>
                    </div>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[color:var(--px-text-muted)]">
                      {displayedVersion.description}
                    </p>
                    <p className="mt-3 text-xs font-bold text-[color:var(--px-text-muted)]">
                      {displayedVersion.deliveryDays} days · {displayedVersion.includedRevisions} included revisions
                    </p>
                  </article>
                ) : null}

                {submittedVersion ? (
                  <div className="mt-4 grid gap-3">
                    <div className="flex flex-wrap gap-2">
                      <form action={acceptProposalAction}>
                        <input name="versionId" type="hidden" value={submittedVersion.id} />
                        <Button type="submit">Accept exact version</Button>
                      </form>
                      <form action={rejectProposalAction}>
                        <input name="versionId" type="hidden" value={submittedVersion.id} />
                        <Button type="submit" variant="destructive">
                          Reject version
                        </Button>
                      </form>
                    </div>
                    <details className="rounded-2xl border border-[color:var(--px-border)] p-4">
                      <summary className="cursor-pointer text-sm font-black text-[color:var(--px-text)]">
                        Request a revision with an objection
                      </summary>
                      <form action={raiseProposalObjectionAction} className="mt-4 grid gap-3">
                        <input name="versionId" type="hidden" value={submittedVersion.id} />
                        <label className="text-xs font-black uppercase tracking-wide text-[color:var(--px-text-muted)]" htmlFor={`objection-${submittedVersion.id}`}>
                          Explain the term that needs to change
                        </label>
                        <Textarea
                          id={`objection-${submittedVersion.id}`}
                          maxLength={1200}
                          minLength={10}
                          name="reason"
                          placeholder="Reference the exact scope, amount, delivery, or acceptance term."
                          required
                        />
                        <Button type="submit" variant="secondary">
                          Record objection
                        </Button>
                      </form>
                    </details>
                  </div>
                ) : (
                  <p className="mt-4 rounded-xl bg-[color:var(--px-muted)] p-3 text-sm font-semibold text-[color:var(--px-text-muted)]">
                    No submitted version is awaiting a decision.
                  </p>
                )}
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState
          body="Submitted proposals for your opportunities will appear here."
          title="No received proposals"
        />
      )}
      <CursorPagination
        basePath="/app/proposals/received"
        cursor={page.cursor}
        label="Received proposals pagination"
        nextCursor={page.nextCursor}
      />
    </AppSection>
  );
}

function formatStatus(value: string) {
  return value.toLocaleLowerCase().replaceAll("_", " ");
}
