import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Handshake,
  LockKeyhole,
  MessageSquareText,
  PackageCheck,
  ShieldAlert,
  Truck,
  Users,
} from "lucide-react";

import { AppSection } from "@/components/app-section";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/session";
import { getConversationForUser, getDealForUser } from "@/lib/data/app";
import { formatMoney } from "@/lib/money";
import { getDealNextAction, getDealRoomProgress, formatDealStage } from "@/lib/deals/room-progress";
import { getPaymentReadiness } from "@/lib/payments/service";

export default async function DealWorkspacePage({
  params,
}: {
  params: Promise<{ dealId: string }>;
}) {
  const { dealId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  // The existing provider enforces a participant-scoped Deal read.
  // No second Deal entity or separate private message store is created.
  const deal = await getDealForUser(dealId, user.id);
  if (!deal) notFound();

  const milestones = deal.milestones ?? [];
  const participants = deal.participants ?? [];
  const history = deal.statusHistory ?? [];
  const progress = getDealRoomProgress(milestones);
  const myRole = participants.find((participant: { userId: string; role: string }) =>
    participant.userId === user.id,
  )?.role as string | undefined;
  const nextAction = getDealNextAction(deal.status, myRole, milestones);
  const originalConversationId = deal.proposal?.conversationId as string | null | undefined;

  // The original conversation may have been removed or may not include this
  // viewer in legacy data. Verify chat access rather than leaking a link.
  const relatedConversation = originalConversationId
    ? await getConversationForUser(originalConversationId, user.id)
    : null;
  const discussionHref = relatedConversation
    ? `/app/messages/${originalConversationId}`
    : null;

  const acceptedTerms = deal.proposalVersion;
  const paymentReadiness = getPaymentReadiness();
  const amount = formatMoney(deal.valueMinor, deal.currency);

  return (
    <AppSection
      description="Your shared Deal room: agreed terms, milestone work, recorded decisions and a link to your conversation."
      title={deal.proposal.opportunity.title}
    >
      <Link href="/app/deals" className="mb-4 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-[color:var(--px-primary-ink)] hover:underline">
        <ArrowLeft aria-hidden size={17} /> All agreements
      </Link>
      <div className="rounded-[26px] border border-[#294e86] bg-[linear-gradient(125deg,#071b3d,#143e80)] p-5 text-white shadow-[0_15px_34px_rgba(4,25,60,0.18)] sm:p-6">
        <p className="text-[11px] font-black uppercase tracking-[0.17em] text-white/85">PtahX · Deal room</p>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-2xl font-black text-white sm:text-3xl">{amount}</h2>
            <p className="mt-1 text-xs font-semibold text-white/80">Agreed value — not money held by PtahX</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-white/35 bg-white/15 px-3 py-1.5 text-xs font-black text-white">
              {formatDealStage(deal.status)}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-200/40 bg-amber-200/20 px-3 py-1.5 text-xs font-black text-amber-100">
              <LockKeyhole aria-hidden size={13} />
              {acceptedTerms?.versionNumber ? `Terms v${acceptedTerms.versionNumber} locked` : "Accepted terms recorded"}
            </span>
          </div>
        </div>
        <p className="mt-4 break-all text-[11px] font-semibold text-white/80">
          Deal reference: {deal.id}
        </p>
        <div className="mt-5 grid grid-cols-3 gap-3 border-t border-white/20 pt-4">
          <div><p className="text-2xl font-black text-white">{progress.completed}/{progress.total}</p><p className="mt-1 text-[11px] text-white/85">Milestones done</p></div>
          <div><p className="text-2xl font-black text-white">{progress.awaitingReview}</p><p className="mt-1 text-[11px] text-white/85">Awaiting review</p></div>
          <div><p className="text-2xl font-black text-white">{participants.length}</p><p className="mt-1 text-[11px] text-white/85">Participants</p></div>
        </div>
      </div>

      <div role="note" className="mt-4 flex items-start gap-3 rounded-2xl border border-amber-300 bg-[#fff6df] p-4 text-[#513a0e] dark:border-amber-400/50 dark:bg-[#403118] dark:text-amber-100">
        <ShieldAlert className="mt-0.5 shrink-0" size={20} aria-hidden />
        <p className="text-sm font-semibold leading-6">
          This is a locked agreement record, not a wallet. PtahX does not collect, hold or release real money.
          {paymentReadiness.available ? " Payment provider readiness does not confirm any payment for this Deal." : " Online payment is currently unavailable."}
        </p>
      </div>

      <nav aria-label="Deal workspace sections" className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Link className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[color:var(--px-border-strong)] bg-[color:var(--px-surface-elevated)] px-3 text-sm font-bold text-[color:var(--px-text)] hover:bg-[color:var(--px-hover)]" href={`/app/deals/${deal.id}/milestones`}><ClipboardCheck aria-hidden size={17} /> Milestones</Link>
        <Link className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[color:var(--px-border-strong)] bg-[color:var(--px-surface-elevated)] px-3 text-sm font-bold text-[color:var(--px-text)] hover:bg-[color:var(--px-hover)]" href={`/app/deals/${deal.id}/deliveries`}><PackageCheck aria-hidden size={17} /> Deliveries</Link>
        <Link className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[color:var(--px-border-strong)] bg-[color:var(--px-surface-elevated)] px-3 text-sm font-bold text-[color:var(--px-text)] hover:bg-[color:var(--px-hover)]" href={`/app/deals/${deal.id}/escrow`}><LockKeyhole aria-hidden size={17} /> Agreement state</Link>
        {discussionHref ? (
          <Link className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#1656cc] px-3 text-sm font-black text-white hover:bg-[#0b459d]" href={discussionHref}><MessageSquareText aria-hidden size={17} /> Discussion</Link>
        ) : (
          <span className="flex min-h-12 items-center justify-center rounded-xl border border-[color:var(--px-border)] bg-[color:var(--px-surface-soft)] px-3 text-center text-xs font-semibold text-[color:var(--px-text-muted)]">No linked discussion</span>
        )}
      </nav>

      {nextAction ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#5b8bd3]/50 bg-[#ecf3ff] p-4 text-[#112c5a] dark:border-[#5b8bd3]/50 dark:bg-[#1a3154] dark:text-white">
          <div className="flex min-w-0 items-start gap-3">
            {nextAction === "review" ? <CheckCircle2 aria-hidden className="mt-0.5 shrink-0" size={21} /> : <Truck aria-hidden className="mt-0.5 shrink-0" size={21} />}
            <div>
              <p className="text-sm font-black">{nextAction === "review" ? "Work is ready for your review" : "Your next step: submit your work"}</p>
              <p className="mt-1 text-xs leading-5">{nextAction === "review" ? "Check the submitted milestone before recording approval." : "Add delivery details for the active milestone."}</p>
            </div>
          </div>
          <ButtonLink href={`/app/deals/${deal.id}/deliveries`} variant="primary" size="sm">
            {nextAction === "review" ? "Review delivery" : "Submit delivery"} <ArrowRight aria-hidden size={16} className="ml-2" />
          </ButtonLink>
        </div>
      ) : null}

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(280px,0.75fr)]">
        <div className="grid content-start gap-5">
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-black text-[color:var(--px-text)]">Work progress</h2>
              <Badge className="border border-[color:var(--px-border-strong)] bg-[color:var(--px-surface-soft)] text-[color:var(--px-text)]">
                {progress.percent}% milestones approved
              </Badge>
            </div>
            <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-[color:var(--px-muted)]" role="progressbar" aria-label="Approved milestone progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.percent}>
              <div className="h-full rounded-full bg-[#16856f] transition-[width]" style={{ width: `${progress.percent}%` }} />
            </div>
            {milestones.length ? (
              <ol className="mt-5 grid gap-3">
                {milestones.slice(0, 8).map((milestone: { id: string; title: string; status: string; description?: string | null; amountMinor: bigint; currency: string }, index: number) => (
                  <li className="flex items-start gap-3 rounded-2xl border border-[color:var(--px-border)] bg-[color:var(--px-surface-soft)] p-3" key={milestone.id}>
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[color:var(--px-primary-soft)] text-sm font-black text-[color:var(--px-primary-ink)]">{index + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-sm font-black text-[color:var(--px-text)]">{milestone.title}</p>
                      {milestone.description ? <p className="mt-1 line-clamp-2 text-xs leading-5 text-[color:var(--px-text-muted)]">{milestone.description}</p> : null}
                      <p className="mt-1 text-xs font-bold text-[color:var(--px-text-muted)]">{formatMoney(milestone.amountMinor, milestone.currency)}</p>
                    </div>
                    <span className="shrink-0 rounded-full border border-[color:var(--px-border-strong)] bg-[color:var(--px-surface)] px-2 py-1 text-[11px] font-black text-[color:var(--px-text)]">{formatDealStage(milestone.status)}</span>
                  </li>
                ))}
              </ol>
            ) : <p className="mt-4 text-sm text-[color:var(--px-text-muted)]">No milestone records have been created for this agreement.</p>}
            <Link href={`/app/deals/${deal.id}/milestones`} className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-black text-[color:var(--px-primary-ink)] hover:underline">
              View all milestones <ArrowRight aria-hidden size={16} />
            </Link>
          </Card>
          <Card>
            <h2 className="flex items-center gap-2 text-lg font-black text-[color:var(--px-text)]"><Clock3 aria-hidden size={20} /> Agreement activity</h2>
            <p className="mt-1 text-xs leading-5 text-[color:var(--px-text-muted)]">Recorded state changes are kept in Deal history. Chat messages are separate.</p>
            {history.length ? (
              <ol className="mt-4 grid gap-3 border-l-2 border-[color:var(--px-border-strong)] pl-4">
                {history.slice(-6).reverse().map((entry: { id: string; toStatus: string; reason?: string | null; createdAt?: Date }) => (
                  <li className="relative text-sm" key={entry.id}>
                    <span className="absolute -left-[22px] top-2 h-2.5 w-2.5 rounded-full bg-[color:var(--px-primary)]" />
                    <p className="font-black text-[color:var(--px-text)]">{formatDealStage(entry.toStatus)}</p>
                    {entry.reason ? <p className="mt-1 break-words text-xs leading-5 text-[color:var(--px-text-muted)]">{entry.reason}</p> : null}
                    {entry.createdAt ? <p className="mt-1 text-xs text-[color:var(--px-text-muted)]">{new Date(entry.createdAt).toLocaleDateString("en-NG")}</p> : null}
                  </li>
                ))}
              </ol>
            ) : <p className="mt-4 text-sm text-[color:var(--px-text-muted)]">No status changes have been recorded yet.</p>}
            <Link href={`/app/deals/${deal.id}/escrow`} className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-black text-[color:var(--px-primary-ink)] hover:underline">Full agreement history <ArrowRight aria-hidden size={16} /></Link>
          </Card>
        </div>

        <div className="grid content-start gap-5">
          <Card>
            <h2 className="flex items-center gap-2 text-base font-black text-[color:var(--px-text)]"><LockKeyhole aria-hidden size={19} /> Accepted terms</h2>
            <p className="mt-2 text-xs font-semibold leading-5 text-[color:var(--px-text-muted)]">This is the accepted version. Changes require a new proposal revision, not an edit to locked terms.</p>
            <dl className="mt-4 grid gap-3 text-sm">
              <div className="flex justify-between gap-3 border-b border-[color:var(--px-border)] pb-2"><dt className="text-[color:var(--px-text-muted)]">Version</dt><dd className="font-black text-[color:var(--px-text)]">{acceptedTerms?.versionNumber ? `v${acceptedTerms.versionNumber}` : "Recorded"}</dd></div>
              <div className="flex justify-between gap-3 border-b border-[color:var(--px-border)] pb-2"><dt className="text-[color:var(--px-text-muted)]">Value</dt><dd className="font-black text-[color:var(--px-text)]">{amount}</dd></div>
              {typeof acceptedTerms?.deliveryDays === "number" ? <div className="flex justify-between gap-3 border-b border-[color:var(--px-border)] pb-2"><dt className="text-[color:var(--px-text-muted)]">Delivery target</dt><dd className="font-black text-[color:var(--px-text)]">{acceptedTerms.deliveryDays} days</dd></div> : null}
              {typeof acceptedTerms?.includedRevisions === "number" ? <div className="flex justify-between gap-3 border-b border-[color:var(--px-border)] pb-2"><dt className="text-[color:var(--px-text-muted)]">Included revisions</dt><dd className="font-black text-[color:var(--px-text)]">{acceptedTerms.includedRevisions}</dd></div> : null}
            </dl>
            {acceptedTerms?.description ? <p className="mt-4 whitespace-pre-wrap break-words rounded-xl bg-[color:var(--px-surface-soft)] p-3 text-sm leading-6 text-[color:var(--px-text)]">{acceptedTerms.description}</p> : null}
          </Card>
          <Card>
            <h2 className="flex items-center gap-2 text-base font-black text-[color:var(--px-text)]"><MessageSquareText aria-hidden size={19} /> Deal discussion</h2>
            <p className="mt-2 text-sm leading-6 text-[color:var(--px-text-muted)]">
              Discuss the work in the linked conversation. Formal decisions stay in the locked agreement history—not in editable chat messages.
            </p>
            {discussionHref ? (
              <Link href={discussionHref} className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#1558d4] px-4 text-sm font-black text-white hover:bg-[#0c469d]">
                <MessageSquareText aria-hidden size={18} /> Open conversation <ArrowRight aria-hidden size={17} />
              </Link>
            ) : (
              <p className="mt-3 rounded-xl border border-[color:var(--px-border)] bg-[color:var(--px-surface-soft)] p-3 text-sm leading-5 text-[color:var(--px-text-muted)]">
                No accessible linked conversation is available for this Deal. Use the agreement records instead.
              </p>
            )}
          </Card>
          <Card>
            <h2 className="flex items-center gap-2 text-base font-black text-[color:var(--px-text)]"><Users aria-hidden size={19} /> Participants</h2>
            <ul className="mt-3 grid gap-2">
              {participants.map((participant: { id: string; role: string; user: { name: string | null; username: string | null } }) => (
                <li key={participant.id} className="flex items-center justify-between gap-2 rounded-xl bg-[color:var(--px-surface-soft)] p-3">
                  <span className="min-w-0 truncate text-sm font-black text-[color:var(--px-text)]">{participant.user?.name || "Participant"}</span>
                  <span className="shrink-0 text-xs font-semibold capitalize text-[color:var(--px-text-muted)]">{participant.role}</span>
                </li>
              ))}
            </ul>
          </Card>
          {deal.proposal.opportunity.type === "PRODUCT" ? (
            <Card>
              <h2 className="flex items-center gap-2 font-black text-[color:var(--px-text)]"><Truck aria-hidden size={18} /> Delivery tracking</h2>
              <p className="mt-2 text-sm leading-6 text-[color:var(--px-text-muted)]">Tracking appears only when a shipment exists. A Deal record alone does not mean a driver is live.</p>
              <Link href="/app/track" className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-black text-[color:var(--px-primary-ink)] hover:underline">Open tracking <ArrowRight aria-hidden size={16} /></Link>
            </Card>
          ) : null}
        </div>
      </div>
    </AppSection>
  );
}
