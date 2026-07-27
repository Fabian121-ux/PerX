import { AdminSection } from "@/components/admin-section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/card";
import {
  applyEnforcementAction,
  recordMessageScopeRevealAction,
  updateModerationCaseStatusAction,
} from "@/features/admin/actions";
import { getPrisma } from "@/lib/db/prisma";

const activeStatuses = [
  "NEW",
  "TRIAGED",
  "ASSIGNED",
  "IN_REVIEW",
  "NEEDS_INFORMATION",
  "ACTION_REQUIRED",
  "ESCALATED",
  "APPEALED",
] as const;

export default async function AdminMessagesPage() {
  const cases = await getPrisma().moderationCase.findMany({
    include: {
      linkedReport: {
        select: {
          category: true,
          createdAt: true,
          reporter: { select: { name: true, username: true } },
        },
      },
      messageScopes: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    where: {
      conversationId: { not: null },
      status: { in: [...activeStatuses] },
    },
  });

  type ScopedMessageContext = Awaited<ReturnType<typeof getScopedMessageContext>>;
  const contextEntries: Array<[string, ScopedMessageContext]> = await Promise.all(
    cases.map(
      async (moderationCase): Promise<[string, ScopedMessageContext]> => [
        moderationCase.id,
        moderationCase.messageScopes.length
          ? await getScopedMessageContext({
              conversationId: moderationCase.conversationId!,
              messageId: moderationCase.messageId,
            })
          : [],
      ],
    ),
  );
  const contexts = new Map<string, ScopedMessageContext>(contextEntries);

  return (
    <AdminSection
      description="Message review is case-based. Private message content is hidden until a scoped reason is recorded."
      title="Message moderation cases"
    >
      {cases.length ? (
        <div className="grid gap-4">
          {cases.map((moderationCase) => {
            const revealed = moderationCase.messageScopes[0];
            const messages = contexts.get(moderationCase.id) ?? [];
            return (
              <Card key={moderationCase.id}>
                <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge>{moderationCase.status.replaceAll("_", " ")}</Badge>
                      <Badge>{moderationCase.category.replaceAll("_", " ")}</Badge>
                      <Badge>{moderationCase.source.replaceAll("_", " ")}</Badge>
                    </div>
                    <h2 className="mt-3 text-base font-black text-[color:var(--px-text)]">
                      {moderationCase.title}
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-[color:var(--px-text-muted)]">
                      Case {moderationCase.id} · Conversation {moderationCase.conversationId}
                      {moderationCase.messageId ? ` · Reported message ${moderationCase.messageId}` : ""}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-[color:var(--px-text-muted)]">
                      Reporter:{" "}
                      {moderationCase.linkedReport?.reporter.username ??
                        moderationCase.linkedReport?.reporter.name ??
                        moderationCase.reporterId ??
                        "Unknown"}
                    </p>
                    <p className="mt-2 text-xs text-[color:var(--px-text-muted)]">
                      Created {moderationCase.createdAt.toLocaleString()}
                    </p>

                    {revealed ? (
                      <div className="mt-4 rounded-[var(--px-radius)] border border-[color:var(--px-border)] bg-[color:var(--px-surface-soft)] p-4">
                        <p className="text-xs font-black uppercase tracking-wide text-[color:var(--px-primary)]">
                          Scoped context revealed
                        </p>
                        <p className="mt-1 text-xs text-[color:var(--px-text-muted)]">
                          Reason recorded · Scope: {revealed.scope}
                        </p>
                        <div className="mt-3 grid gap-2">
                          {messages.map((message) => (
                            <div
                              className={`rounded-[var(--px-radius-sm)] p-3 text-sm ${
                                message.id === moderationCase.messageId
                                  ? "border border-[color:var(--px-warning)] bg-amber-50 text-amber-950"
                                  : "bg-[color:var(--px-surface)] text-[color:var(--px-text)]"
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
                      </div>
                    ) : (
                      <form action={recordMessageScopeRevealAction} className="mt-4 grid gap-3 rounded-[var(--px-radius)] border border-[color:var(--px-border)] bg-[color:var(--px-surface-soft)] p-4">
                        <input name="caseId" type="hidden" value={moderationCase.id} />
                        <input name="scope" type="hidden" value="reported-message-context" />
                        <label className="grid gap-1 text-sm font-semibold text-[color:var(--px-text)]">
                          Reason required before message content reveal
                          <textarea
                            className="min-h-24 rounded-[var(--px-radius-sm)] border border-[color:var(--px-border)] bg-[color:var(--px-surface)] px-3 py-2 text-sm text-[color:var(--px-text)] outline-none focus:ring-2 focus:ring-[color:var(--px-focus)]"
                            maxLength={500}
                            minLength={12}
                            name="reason"
                            placeholder="Link this reveal to the report, support case, policy flag, or approved investigation."
                            required
                          />
                        </label>
                        <Button type="submit" variant="secondary">
                          Reveal scoped context
                        </Button>
                      </form>
                    )}
                  </div>

                  <div className="grid gap-4">
                    <form action={updateModerationCaseStatusAction} className="grid gap-3 rounded-[var(--px-radius)] border border-[color:var(--px-border)] bg-[color:var(--px-surface-soft)] p-4">
                      <input name="caseId" type="hidden" value={moderationCase.id} />
                      <label className="grid gap-1 text-sm font-semibold text-[color:var(--px-text)]">
                        Case status
                        <select
                          className="rounded-[var(--px-radius-sm)] border border-[color:var(--px-border)] bg-[color:var(--px-surface)] px-3 py-2 text-sm text-[color:var(--px-text)] outline-none focus:ring-2 focus:ring-[color:var(--px-focus)]"
                          defaultValue={moderationCase.status}
                          name="status"
                        >
                          {activeStatuses.map((status) => (
                            <option key={status} value={status}>
                              {status.replaceAll("_", " ")}
                            </option>
                          ))}
                          <option value="RESOLVED">RESOLVED</option>
                          <option value="DISMISSED">DISMISSED</option>
                          <option value="CLOSED">CLOSED</option>
                        </select>
                      </label>
                      <label className="grid gap-1 text-sm font-semibold text-[color:var(--px-text)]">
                        Reason
                        <textarea
                          className="min-h-20 rounded-[var(--px-radius-sm)] border border-[color:var(--px-border)] bg-[color:var(--px-surface)] px-3 py-2 text-sm text-[color:var(--px-text)] outline-none focus:ring-2 focus:ring-[color:var(--px-focus)]"
                          maxLength={500}
                          minLength={8}
                          name="reason"
                          required
                        />
                      </label>
                      <Button type="submit" variant="secondary">
                        Update case
                      </Button>
                    </form>

                    {moderationCase.reportedUserId ? (
                      <EnforcementForm
                        caseId={moderationCase.id}
                        targetUserId={moderationCase.reportedUserId}
                      />
                    ) : null}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState
          body="Message-related user reports, policy flags, support investigations, and security cases will appear here."
          title="No message cases"
        />
      )}
    </AdminSection>
  );
}

async function getScopedMessageContext({
  conversationId,
  messageId,
}: {
  conversationId: string;
  messageId: string | null;
}) {
  const reportedMessage = messageId
    ? await getPrisma().message.findUnique({
        select: { createdAt: true },
        where: { id: messageId },
      })
    : null;

  return getPrisma().message.findMany({
    include: {
      sender: { select: { name: true, username: true } },
    },
    orderBy: { createdAt: "asc" },
    take: 12,
    where: {
      conversationId,
      ...(reportedMessage
        ? {
            createdAt: {
              gte: new Date(reportedMessage.createdAt.getTime() - 10 * 60_000),
              lte: new Date(reportedMessage.createdAt.getTime() + 10 * 60_000),
            },
          }
        : {}),
    },
  });
}

function EnforcementForm({
  caseId,
  targetUserId,
}: {
  caseId: string;
  targetUserId: string;
}) {
  return (
    <form action={applyEnforcementAction} className="grid gap-3 rounded-[var(--px-radius)] border border-[color:var(--px-border)] bg-[color:var(--px-surface-soft)] p-4">
      <input name="caseId" type="hidden" value={caseId} />
      <input name="targetUserId" type="hidden" value={targetUserId} />
      <label className="grid gap-1 text-sm font-semibold text-[color:var(--px-text)]">
        Enforcement action
        <select
          className="rounded-[var(--px-radius-sm)] border border-[color:var(--px-border)] bg-[color:var(--px-surface)] px-3 py-2 text-sm text-[color:var(--px-text)] outline-none focus:ring-2 focus:ring-[color:var(--px-focus)]"
          name="type"
        >
          <option value="WARNING">Warning</option>
          <option value="MESSAGING_RESTRICTION">Messaging restriction</option>
          <option value="CONNECTION_REQUEST_RESTRICTION">Connection-request restriction</option>
          <option value="PUBLISHING_RESTRICTION">Publishing restriction</option>
          <option value="VERIFICATION_REQUIRED">Verification required</option>
          <option value="TEMPORARY_SUSPENSION">Temporary suspension</option>
          <option value="INDEFINITE_SUSPENSION">Indefinite suspension</option>
          <option value="DEACTIVATION">Deactivation</option>
          <option value="PERMANENT_BAN">Permanent ban</option>
          <option value="SESSION_REVOCATION">Session revocation</option>
          <option value="RESTORATION">Restoration</option>
        </select>
      </label>
      <label className="grid gap-1 text-sm font-semibold text-[color:var(--px-text)]">
        Duration
        <select
          className="rounded-[var(--px-radius-sm)] border border-[color:var(--px-border)] bg-[color:var(--px-surface)] px-3 py-2 text-sm text-[color:var(--px-text)] outline-none focus:ring-2 focus:ring-[color:var(--px-focus)]"
          name="duration"
        >
          <option value="24h">24 hours</option>
          <option value="1h">1 hour</option>
          <option value="3d">3 days</option>
          <option value="7d">7 days</option>
          <option value="14d">14 days</option>
          <option value="30d">30 days</option>
          <option value="custom">Custom expiry</option>
        </select>
      </label>
      <label className="grid gap-1 text-sm font-semibold text-[color:var(--px-text)]">
        Custom expiry
        <input
          className="rounded-[var(--px-radius-sm)] border border-[color:var(--px-border)] bg-[color:var(--px-surface)] px-3 py-2 text-sm text-[color:var(--px-text)] outline-none focus:ring-2 focus:ring-[color:var(--px-focus)]"
          name="customExpiry"
          type="datetime-local"
        />
      </label>
      <label className="grid gap-1 text-sm font-semibold text-[color:var(--px-text)]">
        Reason
        <textarea className="min-h-20 rounded-[var(--px-radius-sm)] border border-[color:var(--px-border)] bg-[color:var(--px-surface)] px-3 py-2 text-sm text-[color:var(--px-text)] outline-none focus:ring-2 focus:ring-[color:var(--px-focus)]" maxLength={500} minLength={8} name="reason" required />
      </label>
      <label className="grid gap-1 text-sm font-semibold text-[color:var(--px-text)]">
        User-facing explanation
        <textarea className="min-h-20 rounded-[var(--px-radius-sm)] border border-[color:var(--px-border)] bg-[color:var(--px-surface)] px-3 py-2 text-sm text-[color:var(--px-text)] outline-none focus:ring-2 focus:ring-[color:var(--px-focus)]" maxLength={500} minLength={8} name="userFacingExplanation" required />
      </label>
      <label className="grid gap-1 text-sm font-semibold text-[color:var(--px-text)]">
        Internal note
        <textarea className="min-h-20 rounded-[var(--px-radius-sm)] border border-[color:var(--px-border)] bg-[color:var(--px-surface)] px-3 py-2 text-sm text-[color:var(--px-text)] outline-none focus:ring-2 focus:ring-[color:var(--px-focus)]" maxLength={800} minLength={8} name="internalNote" required />
      </label>
      <label className="grid gap-1 text-sm font-semibold text-[color:var(--px-text)]">
        Permanent-ban confirmation
        <input
          className="rounded-[var(--px-radius-sm)] border border-[color:var(--px-border)] bg-[color:var(--px-surface)] px-3 py-2 text-sm text-[color:var(--px-text)] outline-none focus:ring-2 focus:ring-[color:var(--px-focus)]"
          name="confirmation"
          placeholder="Type PERMANENT_BAN only when applying that action"
        />
      </label>
      <label className="flex items-center gap-2 text-sm font-semibold text-[color:var(--px-text)]">
        <input defaultChecked name="appealAllowed" type="checkbox" />
        Appeal allowed
      </label>
      <Button type="submit">Apply enforcement</Button>
    </form>
  );
}
