import { notFound } from "next/navigation";

import { AdminSection } from "@/components/admin-section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  applyEnforcementAction,
  recordMessageScopeRevealAction,
  updateModerationCaseStatusAction,
} from "@/features/admin/actions";
import { getPrisma } from "@/lib/db/prisma";

const statuses = [
  "NEW",
  "TRIAGED",
  "ASSIGNED",
  "IN_REVIEW",
  "NEEDS_INFORMATION",
  "ACTION_REQUIRED",
  "ESCALATED",
  "RESOLVED",
  "DISMISSED",
  "APPEALED",
  "CLOSED",
] as const;

export default async function AdminModerationCasePage({
  params,
}: {
  params: Promise<{ caseId: string }>;
}) {
  const { caseId } = await params;
  const moderationCase = await getPrisma().moderationCase.findUnique({
    include: {
      enforcementActions: { orderBy: { createdAt: "desc" }, take: 10 },
      events: { orderBy: { createdAt: "desc" }, take: 20 },
      linkedReport: {
        select: {
          category: true,
          createdAt: true,
          reporter: { select: { name: true, username: true } },
        },
      },
      messageScopes: { orderBy: { createdAt: "desc" }, take: 1 },
    },
    where: { id: caseId },
  });
  if (!moderationCase) notFound();

  const messages =
    moderationCase.conversationId && moderationCase.messageScopes.length
      ? await getPrisma().message.findMany({
          include: { sender: { select: { name: true, username: true } } },
          orderBy: { createdAt: "asc" },
          take: 12,
          where: { conversationId: moderationCase.conversationId },
        })
      : [];

  return (
    <AdminSection
      description="Case details, scoped review state, enforcement actions, and audit-safe timeline."
      title="Moderation case"
    >
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="grid gap-4">
          <Card>
            <div className="flex flex-wrap items-center gap-2">
              <Badge>{moderationCase.status.replaceAll("_", " ")}</Badge>
              <Badge>{moderationCase.source.replaceAll("_", " ")}</Badge>
              <Badge>{moderationCase.category.replaceAll("_", " ")}</Badge>
            </div>
            <h1 className="mt-3 text-lg font-black text-[color:var(--px-text)]">
              {moderationCase.title}
            </h1>
            <p className="mt-2 text-sm leading-6 text-[color:var(--px-text-muted)]">
              {moderationCase.summary}
            </p>
            <p className="mt-3 text-xs text-[color:var(--px-text-muted)]">
              Case {moderationCase.id} · Target {moderationCase.targetType} {moderationCase.targetId}
            </p>
          </Card>

          {moderationCase.conversationId ? (
            moderationCase.messageScopes.length ? (
              <Card>
                <h2 className="font-black text-[color:var(--px-text)]">
                  Scoped message context
                </h2>
                <div className="mt-3 grid gap-2">
                  {messages.map((message) => (
                    <div
                      className={`rounded-[var(--px-radius-sm)] p-3 text-sm ${
                        message.id === moderationCase.messageId
                          ? "border border-[color:var(--px-warning)] bg-amber-50 text-amber-950"
                          : "bg-[color:var(--px-surface-soft)] text-[color:var(--px-text)]"
                      }`}
                      key={message.id}
                    >
                      <p className="text-xs font-bold text-[color:var(--px-text-muted)]">
                        {message.sender.username || message.sender.name} ·{" "}
                        {message.createdAt.toLocaleString()}
                      </p>
                      <p className="mt-1 whitespace-pre-wrap break-words leading-6">
                        {message.deletedAt ? "This message was deleted." : message.body}
                      </p>
                    </div>
                  ))}
                </div>
              </Card>
            ) : (
              <Card>
                <h2 className="font-black text-[color:var(--px-text)]">
                  Message content hidden
                </h2>
                <form action={recordMessageScopeRevealAction} className="mt-4 grid gap-3">
                  <input name="caseId" type="hidden" value={moderationCase.id} />
                  <input name="scope" type="hidden" value="reported-message-context" />
                  <label className="grid gap-1 text-sm font-semibold text-[color:var(--px-text)]">
                    Reason
                    <textarea
                      className="min-h-24 rounded-[var(--px-radius-sm)] border border-[color:var(--px-border)] bg-[color:var(--px-surface)] px-3 py-2 text-sm text-[color:var(--px-text)] outline-none focus:ring-2 focus:ring-[color:var(--px-focus)]"
                      minLength={12}
                      name="reason"
                      required
                    />
                  </label>
                  <Button type="submit" variant="secondary">
                    Reveal scoped context
                  </Button>
                </form>
              </Card>
            )
          ) : null}

          <Card>
            <h2 className="font-black text-[color:var(--px-text)]">Timeline</h2>
            <div className="mt-3 grid gap-2">
              {moderationCase.events.map((event) => (
                <div className="rounded-[var(--px-radius-sm)] bg-[color:var(--px-surface-soft)] p-3 text-sm" key={event.id}>
                  <p className="font-bold text-[color:var(--px-text)]">{event.type}</p>
                  <p className="text-xs text-[color:var(--px-text-muted)]">
                    {event.createdAt.toLocaleString()}
                    {event.nextStatus ? ` · ${event.nextStatus.replaceAll("_", " ")}` : ""}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="grid gap-4 self-start">
          <form action={updateModerationCaseStatusAction} className="grid gap-3 rounded-[var(--px-radius)] border border-[color:var(--px-border)] bg-[color:var(--px-surface)] p-4">
            <input name="caseId" type="hidden" value={moderationCase.id} />
            <label className="grid gap-1 text-sm font-semibold text-[color:var(--px-text)]">
              Status
              <select className="rounded-[var(--px-radius-sm)] border border-[color:var(--px-border)] bg-[color:var(--px-surface)] px-3 py-2 text-sm text-[color:var(--px-text)]" defaultValue={moderationCase.status} name="status">
                {statuses.map((status) => (
                  <option key={status} value={status}>{status.replaceAll("_", " ")}</option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-semibold text-[color:var(--px-text)]">
              Reason
              <textarea className="min-h-20 rounded-[var(--px-radius-sm)] border border-[color:var(--px-border)] bg-[color:var(--px-surface)] px-3 py-2 text-sm text-[color:var(--px-text)]" minLength={8} name="reason" required />
            </label>
            <Button type="submit" variant="secondary">Update case</Button>
          </form>

          {moderationCase.reportedUserId ? (
            <form action={applyEnforcementAction} className="grid gap-3 rounded-[var(--px-radius)] border border-[color:var(--px-border)] bg-[color:var(--px-surface)] p-4">
              <input name="caseId" type="hidden" value={moderationCase.id} />
              <input name="targetUserId" type="hidden" value={moderationCase.reportedUserId} />
              <input name="duration" type="hidden" value="24h" />
              <label className="grid gap-1 text-sm font-semibold text-[color:var(--px-text)]">
                Quick action
                <select className="rounded-[var(--px-radius-sm)] border border-[color:var(--px-border)] bg-[color:var(--px-surface)] px-3 py-2 text-sm text-[color:var(--px-text)]" name="type">
                  <option value="WARNING">Warning</option>
                  <option value="MESSAGING_RESTRICTION">24-hour messaging restriction</option>
                  <option value="RESTORATION">Restoration</option>
                </select>
              </label>
              <label className="grid gap-1 text-sm font-semibold text-[color:var(--px-text)]">
                Reason
                <textarea className="min-h-20 rounded-[var(--px-radius-sm)] border border-[color:var(--px-border)] bg-[color:var(--px-surface)] px-3 py-2 text-sm text-[color:var(--px-text)]" minLength={8} name="reason" required />
              </label>
              <label className="grid gap-1 text-sm font-semibold text-[color:var(--px-text)]">
                User-facing explanation
                <textarea className="min-h-20 rounded-[var(--px-radius-sm)] border border-[color:var(--px-border)] bg-[color:var(--px-surface)] px-3 py-2 text-sm text-[color:var(--px-text)]" minLength={8} name="userFacingExplanation" required />
              </label>
              <label className="grid gap-1 text-sm font-semibold text-[color:var(--px-text)]">
                Internal note
                <textarea className="min-h-20 rounded-[var(--px-radius-sm)] border border-[color:var(--px-border)] bg-[color:var(--px-surface)] px-3 py-2 text-sm text-[color:var(--px-text)]" minLength={8} name="internalNote" required />
              </label>
              <Button type="submit">Apply action</Button>
            </form>
          ) : null}
        </div>
      </div>
    </AdminSection>
  );
}
