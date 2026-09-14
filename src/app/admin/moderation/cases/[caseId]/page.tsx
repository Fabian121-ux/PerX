import { notFound } from "next/navigation";

import { AdminSection } from "@/components/admin-section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  applyEnforcementAction,
  initiateUserPasswordResetAction,
  recordMessageScopeRevealAction,
  reviewPolicyFlagCaseAction,
  updateModerationCaseStatusAction,
} from "@/features/admin/actions";
import {
  formatAdminValue,
  getAdminModerationCase,
  getScopedMessageContext,
  messageReviewScopeOptions,
  moderationCaseStatuses,
  safeUserLabel,
} from "@/lib/admin/moderation-records";
import { requireCapabilityOrNotFound } from "@/lib/auth/session";
import { hasCapability } from "@/lib/permissions/capabilities";

export default async function AdminModerationCasePage({
  params,
}: {
  params: Promise<{ caseId: string }>;
}) {
  const admin = await requireCapabilityOrNotFound("admin:moderate");
  const canReadMessages = hasCapability(admin.roles, "messages:moderate");
  const canEnforce = hasCapability(admin.roles, "enforcement:manage");
  const canManageUsers = hasCapability(admin.roles, "users:manage");
  const { caseId } = await params;
  const moderationCase = await getAdminModerationCase(caseId);
  if (!moderationCase) notFound();

  // Only an open policy flag on a listing is decidable here; a resolved case
  // has already released or withheld the listing.
  const isDecidablePolicyFlag =
    moderationCase.source === "POLICY_FLAG" &&
    moderationCase.targetType === "opportunity" &&
    !["RESOLVED", "DISMISSED", "CLOSED"].includes(moderationCase.status);

  const messages =
    canReadMessages &&
    moderationCase.conversationId &&
    moderationCase.messageScopes.length
      ? await getScopedMessageContext({
          caseId: moderationCase.id,
          conversationId: moderationCase.conversationId,
          messageId: moderationCase.messageId,
          scope: moderationCase.messageScopes[0]?.scope,
        })
      : { kind: "hidden" as const, messages: [] };

  return (
    <AdminSection
      description="Case details, scoped review state, enforcement actions, and audit-safe timeline."
      title="Moderation case"
    >
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="grid gap-4">
          <Card>
            <div className="flex flex-wrap items-center gap-2">
              <Badge>{formatAdminValue(moderationCase.status)}</Badge>
              <Badge>{formatAdminValue(moderationCase.source)}</Badge>
              <Badge>{formatAdminValue(moderationCase.category)}</Badge>
            </div>
            <h1 className="mt-3 text-lg font-black text-[color:var(--px-text)]">
              {moderationCase.title}
            </h1>
            <p className="mt-2 text-sm leading-6 text-[color:var(--px-text-muted)]">
              {moderationCase.summary}
            </p>
            <p className="mt-3 text-xs text-[color:var(--px-text-muted)]">
              Case {moderationCase.id} · Target {moderationCase.targetType}{" "}
              {moderationCase.targetId}
            </p>
            <p className="mt-2 text-xs text-[color:var(--px-text-muted)]">
              Reporter:{" "}
              {safeUserLabel(
                moderationCase.reporter,
                moderationCase.reporterId,
              )}
              {moderationCase.reportedUserId
                ? ` · Reported account: ${safeUserLabel(moderationCase.reportedUser, moderationCase.reportedUserId)}`
                : ""}
            </p>
          </Card>

          {moderationCase.conversationId ? (
            moderationCase.messageScopes.length ? (
              <Card>
                <h2 className="font-black text-[color:var(--px-text)]">
                  Scoped message context
                </h2>
                {messages.kind === "available" ? (
                  <div className="mt-3 grid gap-2">
                    {messages.messages.map((message) => (
                      <div
                        className={`rounded-[var(--px-radius-sm)] p-3 text-sm ${
                          message.id === moderationCase.messageId
                            ? "border border-[color:var(--px-warning)] bg-amber-50 text-amber-950"
                            : "bg-[color:var(--px-surface-soft)] text-[color:var(--px-text)]"
                        }`}
                        key={message.id}
                      >
                        <p className="text-xs font-bold text-[color:var(--px-text-muted)]">
                          {safeUserLabel(message.sender, message.senderId)} ·{" "}
                          {message.createdAt.toLocaleString()}
                        </p>
                        <p className="mt-1 whitespace-pre-wrap break-words leading-6">
                          {message.deletedAt
                            ? "This message was deleted."
                            : message.body}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EvidenceUnavailableState kind={messages.kind} />
                )}
              </Card>
            ) : moderationCase.messageId ? (
              <Card>
                <h2 className="font-black text-[color:var(--px-text)]">
                  Message content hidden
                </h2>
                <form
                  action={recordMessageScopeRevealAction}
                  className="mt-4 grid gap-3"
                >
                  <input
                    name="caseId"
                    type="hidden"
                    value={moderationCase.id}
                  />
                  <label className="grid gap-1 text-sm font-semibold text-[color:var(--px-text)]">
                    Review scope
                    <select
                      className="rounded-[var(--px-radius-sm)] border border-[color:var(--px-border)] bg-[color:var(--px-surface)] px-3 py-2 text-sm text-[color:var(--px-text)]"
                      name="scope"
                    >
                      {messageReviewScopeOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-1 text-sm font-semibold text-[color:var(--px-text)]">
                    Reason
                    <textarea
                      className="min-h-24 rounded-[var(--px-radius-sm)] border border-[color:var(--px-border)] bg-[color:var(--px-surface)] px-3 py-2 text-sm text-[color:var(--px-text)] outline-none focus:ring-2 focus:ring-[color:var(--px-focus)]"
                      maxLength={500}
                      minLength={12}
                      name="reason"
                      required
                    />
                  </label>
                  <label className="flex items-start gap-2 text-sm font-semibold text-[color:var(--px-text)]">
                    <input
                      className="mt-1"
                      name="confirmScope"
                      required
                      type="checkbox"
                    />
                    I confirm this reveal is limited to the selected moderation
                    scope.
                  </label>
                  <Button type="submit" variant="secondary">
                    Reveal scoped context
                  </Button>
                </form>
              </Card>
            ) : (
              <Card>
                <h2 className="font-black text-[color:var(--px-text)]">
                  Message evidence unavailable
                </h2>
                <EvidenceUnavailableState kind="no-message-id" />
              </Card>
            )
          ) : (
            <Card>
              <h2 className="font-black text-[color:var(--px-text)]">
                No private message scope
              </h2>
              <p className="mt-2 text-sm text-[color:var(--px-text-muted)]">
                This case is not linked to a conversation. Review available
                metadata, reports, audit events, or related public content.
              </p>
            </Card>
          )}

          <Card>
            <h2 className="font-black text-[color:var(--px-text)]">Timeline</h2>
            <div className="mt-3 grid gap-2">
              {moderationCase.events.map((event) => (
                <div
                  className="rounded-[var(--px-radius-sm)] bg-[color:var(--px-surface-soft)] p-3 text-sm"
                  key={event.id}
                >
                  <p className="font-bold text-[color:var(--px-text)]">
                    {event.type}
                  </p>
                  <p className="text-xs text-[color:var(--px-text-muted)]">
                    {event.createdAt.toLocaleString()}
                    {event.nextStatus
                      ? ` · ${formatAdminValue(event.nextStatus)}`
                      : ""}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="grid gap-4 self-start">
          {isDecidablePolicyFlag ? (
            /*
             * The decision that releases or withholds the listing. Separate
             * from the generic status form below because moving a policy-flag
             * case to RESOLVED without also writing the listing's
             * moderationStatus would leave the author withheld forever with a
             * closed case - the exact inconsistency P0-4 fixed.
             */
            <form
              action={reviewPolicyFlagCaseAction}
              className="grid gap-3 rounded-[var(--px-radius)] border border-[color:var(--px-border)] bg-[color:var(--px-surface)] p-4"
            >
              <input name="caseId" type="hidden" value={moderationCase.id} />
              <h2 className="text-sm font-bold text-[color:var(--px-text)]">
                Decide this policy flag
              </h2>
              <p className="text-xs leading-5 text-[color:var(--px-text-muted)]">
                This listing is withheld from every public feed and its author
                was told a review is coming. Clearing publishes it; upholding
                keeps it withheld. Either way the author is notified, and never
                told which rule matched.
              </p>
              <label className="grid gap-1 text-sm font-semibold text-[color:var(--px-text)]">
                Decision
                <select
                  className="rounded-[var(--px-radius-sm)] border border-[color:var(--px-border)] bg-[color:var(--px-surface)] px-3 py-2 text-sm text-[color:var(--px-text)]"
                  defaultValue="clear"
                  name="decision"
                >
                  <option value="clear">Clear - publish the listing</option>
                  <option value="uphold">Uphold - keep it withheld</option>
                </select>
              </label>
              <label className="grid gap-1 text-sm font-semibold text-[color:var(--px-text)]">
                Reason
                <textarea
                  className="min-h-20 rounded-[var(--px-radius-sm)] border border-[color:var(--px-border)] bg-[color:var(--px-surface)] px-3 py-2 text-sm text-[color:var(--px-text)]"
                  minLength={8}
                  name="reason"
                  required
                />
              </label>
              <Button type="submit">Record decision</Button>
            </form>
          ) : null}

          <form
            action={updateModerationCaseStatusAction}
            className="grid gap-3 rounded-[var(--px-radius)] border border-[color:var(--px-border)] bg-[color:var(--px-surface)] p-4"
          >
            <input name="caseId" type="hidden" value={moderationCase.id} />
            <label className="grid gap-1 text-sm font-semibold text-[color:var(--px-text)]">
              Status
              <select
                className="rounded-[var(--px-radius-sm)] border border-[color:var(--px-border)] bg-[color:var(--px-surface)] px-3 py-2 text-sm text-[color:var(--px-text)]"
                defaultValue={moderationCase.status}
                name="status"
              >
                {moderationCaseStatuses.map((status) => (
                  <option key={status} value={status}>
                    {formatAdminValue(status)}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-semibold text-[color:var(--px-text)]">
              Reason
              <textarea
                className="min-h-20 rounded-[var(--px-radius-sm)] border border-[color:var(--px-border)] bg-[color:var(--px-surface)] px-3 py-2 text-sm text-[color:var(--px-text)]"
                minLength={8}
                name="reason"
                required
              />
            </label>
            <Button type="submit" variant="secondary">
              Update case
            </Button>
          </form>

          {canEnforce && moderationCase.reportedUserId ? (
            <form
              action={applyEnforcementAction}
              className="grid gap-3 rounded-[var(--px-radius)] border border-[color:var(--px-border)] bg-[color:var(--px-surface)] p-4"
            >
              <input name="caseId" type="hidden" value={moderationCase.id} />
              <input
                name="targetUserId"
                type="hidden"
                value={moderationCase.reportedUserId}
              />
              <input name="duration" type="hidden" value="24h" />
              <label className="grid gap-1 text-sm font-semibold text-[color:var(--px-text)]">
                Quick action
                <select
                  className="rounded-[var(--px-radius-sm)] border border-[color:var(--px-border)] bg-[color:var(--px-surface)] px-3 py-2 text-sm text-[color:var(--px-text)]"
                  name="type"
                >
                  <option value="WARNING">Warning</option>
                  <option value="MESSAGING_RESTRICTION">
                    24-hour messaging restriction
                  </option>
                  <option value="RESTORATION">Restoration</option>
                </select>
              </label>
              <label className="grid gap-1 text-sm font-semibold text-[color:var(--px-text)]">
                Reason
                <textarea
                  className="min-h-20 rounded-[var(--px-radius-sm)] border border-[color:var(--px-border)] bg-[color:var(--px-surface)] px-3 py-2 text-sm text-[color:var(--px-text)]"
                  minLength={8}
                  name="reason"
                  required
                />
              </label>
              <label className="grid gap-1 text-sm font-semibold text-[color:var(--px-text)]">
                User-facing explanation
                <textarea
                  className="min-h-20 rounded-[var(--px-radius-sm)] border border-[color:var(--px-border)] bg-[color:var(--px-surface)] px-3 py-2 text-sm text-[color:var(--px-text)]"
                  minLength={8}
                  name="userFacingExplanation"
                  required
                />
              </label>
              <label className="grid gap-1 text-sm font-semibold text-[color:var(--px-text)]">
                Internal note
                <textarea
                  className="min-h-20 rounded-[var(--px-radius-sm)] border border-[color:var(--px-border)] bg-[color:var(--px-surface)] px-3 py-2 text-sm text-[color:var(--px-text)]"
                  minLength={8}
                  name="internalNote"
                  required
                />
              </label>
              <Button type="submit">Apply action</Button>
            </form>
          ) : null}

          {canManageUsers && moderationCase.reportedUserId ? (
            /*
              Account recovery, not password replacement: this sends the user a
              single-use reset link. The admin never sees or chooses the
              password, and never sees the stored hash. Gated again on the
              server by `users:manage`.
            */
            <form
              action={initiateUserPasswordResetAction}
              className="grid gap-3 rounded-[var(--px-radius)] border border-[color:var(--px-border)] bg-[color:var(--px-surface)] p-4"
            >
              <input
                name="userId"
                type="hidden"
                value={moderationCase.reportedUserId}
              />
              <h3 className="text-sm font-black text-[color:var(--px-text)]">
                Account recovery
              </h3>
              <p className="text-sm text-[color:var(--px-text-muted)]">
                Sends this user a single-use password reset link. Existing
                sessions end once they choose a new password. The current
                password is never shown to administrators.
              </p>
              <Button type="submit" variant="secondary">
                Send password reset link
              </Button>
            </form>
          ) : null}
        </div>
      </div>
    </AdminSection>
  );
}

function EvidenceUnavailableState({ kind }: { kind: string }) {
  const message =
    kind === "conversation-unavailable"
      ? "Conversation unavailable"
      : kind === "message-unavailable"
        ? "Reported message unavailable"
        : kind === "no-message-id"
          ? "Legacy report - no message identifier"
          : "No scoped message access authorised";

  return (
    <div className="mt-3 rounded-[var(--px-radius-sm)] border border-dashed border-[color:var(--px-border)] bg-[color:var(--px-surface-soft)] p-4 text-sm font-semibold text-[color:var(--px-text-muted)]">
      {message}
    </div>
  );
}
