/* eslint-disable @typescript-eslint/no-explicit-any */
import { AppSection } from "@/components/app-section";
import { CursorPagination } from "@/components/cursor-pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/form";
import {
  createProposalRevisionAction,
  deleteProposalDraftAction,
  submitProposalDraftAction,
  updateProposalDraftAction,
} from "@/features/proposals/actions";
import { getCurrentUser } from "@/lib/auth/session";
import { getUserProposalsPage } from "@/lib/data/app";
import { formatMoney } from "@/lib/money";

export default async function ProposalsSentPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  const user = await getCurrentUser();
  const params = await searchParams;
  const page = await getUserProposalsPage(user!.id, "sent", {
    cursor: params.cursor,
    pageSize: 20,
  });
  const proposals = page.items;

  return (
    <AppSection
      description="Drafts stay editable and private. Every submitted version is locked and retained so accepted terms cannot be silently replaced."
      title="Proposals sent"
    >
      {proposals.length ? (
        <div className="grid gap-5">
          {proposals.map((proposal: any) => {
            const draft = proposal.versions.find(
              (version: any) => version.status === "DRAFT",
            );
            const latestSubmitted = proposal.versions.find(
              (version: any) => version.status === "SUBMITTED",
            );

            return (
              <Card className="overflow-hidden p-0" key={proposal.id}>
                <div className="bg-[linear-gradient(135deg,var(--px-navy),var(--px-navy-3))] p-5 text-white">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/55">
                        Proposal record
                      </p>
                      <h2 className="mt-1 text-lg font-black">
                        {proposal.opportunity.title}
                      </h2>
                    </div>
                    <Badge className="border-white/15 bg-white/10 text-white">
                      {formatStatus(proposal.status)}
                    </Badge>
                  </div>
                </div>

                <div className="grid gap-5 p-5">
                  <div className="flex flex-wrap gap-2">
                    {proposal.versions.map((version: any) => (
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-black ${
                          version.status === "DRAFT"
                            ? "bg-amber-500/10 text-amber-800 dark:text-amber-200"
                            : version.status === "ACCEPTED"
                              ? "bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
                              : "bg-[color:var(--px-primary-soft)] text-[color:var(--px-primary)]"
                        }`}
                        key={version.id}
                      >
                        v{version.versionNumber} · {formatStatus(version.status)}
                      </span>
                    ))}
                  </div>

                  {draft ? (
                    <div className="rounded-2xl border border-amber-300/60 bg-amber-50/60 p-4 dark:border-amber-400/20 dark:bg-amber-950/20">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-black uppercase tracking-wide text-amber-800 dark:text-amber-200">
                            Editable draft · v{draft.versionNumber}
                          </p>
                          <p className="mt-1 text-xs leading-5 text-[color:var(--px-text-muted)]">
                            Only you can see this draft. Submitting locks these exact terms.
                          </p>
                        </div>
                        <span className="text-sm font-black text-[color:var(--px-text)]">
                          {formatMoney(draft.amountMinor, draft.currency)}
                        </span>
                      </div>
                      <form action={updateProposalDraftAction} className="mt-4 grid gap-4">
                        <input name="versionId" type="hidden" value={draft.id} />
                        <input
                          name="opportunityId"
                          type="hidden"
                          value={proposal.opportunityId}
                        />
                        <div className="grid gap-4 sm:grid-cols-3">
                          <Field label="Amount">
                            <Input
                              defaultValue={minorToInput(draft.amountMinor)}
                              name="amount"
                              required
                            />
                          </Field>
                          <Field label="Delivery days">
                            <Input
                              defaultValue={draft.deliveryDays}
                              min={1}
                              name="deliveryDays"
                              required
                              type="number"
                            />
                          </Field>
                          <Field label="Included revisions">
                            <Input
                              defaultValue={draft.includedRevisions}
                              min={0}
                              name="revisions"
                              required
                              type="number"
                            />
                          </Field>
                        </div>
                        <Field label="Scope and acceptance details">
                          <Textarea
                            defaultValue={draft.description}
                            name="description"
                            required
                          />
                        </Field>
                        <div className="flex flex-wrap gap-2">
                          <Button type="submit" variant="secondary">
                            Save draft changes
                          </Button>
                          <Button formAction={submitProposalDraftAction} type="submit">
                            Submit and lock v{draft.versionNumber}
                          </Button>
                          <Button
                            formAction={deleteProposalDraftAction}
                            formNoValidate
                            type="submit"
                            variant="destructive"
                          >
                            Delete draft
                          </Button>
                        </div>
                      </form>
                    </div>
                  ) : latestSubmitted && !["ACCEPTED", "REJECTED"].includes(proposal.status) ? (
                    <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[color:var(--px-border)] bg-[color:var(--px-surface-soft)] p-4">
                      <div>
                        <p className="text-sm font-black text-[color:var(--px-text)]">
                          v{latestSubmitted.versionNumber} is locked
                        </p>
                        <p className="mt-1 text-xs leading-5 text-[color:var(--px-text-muted)]">
                          Create a separate draft revision instead of changing submitted terms.
                        </p>
                      </div>
                      <form action={createProposalRevisionAction}>
                        <input
                          name="versionId"
                          type="hidden"
                          value={latestSubmitted.id}
                        />
                        <Button type="submit" variant="secondary">
                          Create revision
                        </Button>
                      </form>
                    </div>
                  ) : null}

                  <div className="grid gap-3">
                    {proposal.versions
                      .filter((version: any) => version.status !== "DRAFT")
                      .map((version: any) => (
                        <article
                          className="rounded-2xl border border-[color:var(--px-border)] p-4"
                          key={version.id}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <h3 className="font-black text-[color:var(--px-text)]">
                              Locked version {version.versionNumber}
                            </h3>
                            <span className="text-sm font-black text-[color:var(--px-primary)]">
                              {formatMoney(version.amountMinor, version.currency)}
                            </span>
                          </div>
                          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[color:var(--px-text-muted)]">
                            {version.description}
                          </p>
                          <p className="mt-3 text-xs font-bold text-[color:var(--px-text-muted)]">
                            {version.deliveryDays} days · {version.includedRevisions} included revisions · {formatStatus(version.status)}
                          </p>
                        </article>
                      ))}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState
          body="Create a private draft or submit a proposal from an opportunity detail page."
          title="No proposals yet"
        />
      )}
      <CursorPagination
        basePath="/app/proposals/sent"
        cursor={page.cursor}
        label="Sent proposals pagination"
        nextCursor={page.nextCursor}
      />
    </AppSection>
  );
}

function minorToInput(value: bigint) {
  const major = value / 100n;
  const minor = value % 100n;
  return minor ? `${major}.${minor.toString().padStart(2, "0")}` : major.toString();
}

function formatStatus(value: string) {
  return value.toLocaleLowerCase().replaceAll("_", " ");
}
