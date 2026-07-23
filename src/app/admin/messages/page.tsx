import { AdminSection } from "@/components/admin-section";
import { Button } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/card";
import { recordConversationReviewAction } from "@/features/admin/actions";
import { getPrisma } from "@/lib/db/prisma";

export default async function AdminMessagesPage() {
  const conversations = await getPrisma().conversation.findMany({
    include: {
      _count: { select: { messages: true, participants: true } },
      opportunity: { select: { title: true } },
      participants: {
        include: {
          user: { select: { id: true, name: true, username: true } },
        },
        take: 6,
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 25,
  });

  return (
    <AdminSection
      description="Review private-conversation metadata. Message contents are not shown here; moderation access must be tied to a reason and audit record."
      title="Message moderation"
    >
      {conversations.length ? (
        <div className="grid gap-4">
          {conversations.map((conversation) => (
            <Card key={conversation.id}>
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-[color:var(--px-primary)]">
                    {conversation.status}
                  </p>
                  <h2 className="mt-1 font-bold text-[color:var(--px-text)]">
                    {conversation.opportunity?.title ?? "Direct conversation"}
                  </h2>
                  <p className="mt-2 text-sm text-[color:var(--px-text-muted)]">
                    Conversation {conversation.id} · {conversation._count.participants} participant(s) · {conversation._count.messages} message(s)
                  </p>
                  <p className="mt-2 text-sm text-[color:var(--px-text-muted)]">
                    Participants:{" "}
                    {conversation.participants
                      .map((participant) => participant.user.username || participant.user.name || participant.user.id)
                      .join(", ")}
                  </p>
                  <p className="mt-2 text-xs text-[color:var(--px-text-muted)]">
                    Last activity {conversation.updatedAt.toLocaleString()}
                  </p>
                </div>
                <form action={recordConversationReviewAction} className="grid gap-3">
                  <input name="conversationId" type="hidden" value={conversation.id} />
                  <label className="grid gap-1 text-sm font-semibold text-[color:var(--px-text)]">
                    Moderation reason
                    <textarea
                      className="min-h-24 rounded-[var(--px-radius-sm)] border border-[color:var(--px-border)] bg-[color:var(--px-surface)] px-3 py-2 text-sm text-[color:var(--px-text)] outline-none focus:ring-2 focus:ring-[color:var(--px-focus)]"
                      maxLength={500}
                      minLength={12}
                      name="reason"
                      placeholder="Link this review to a report, support case, safety trigger, or approved investigation."
                      required
                    />
                  </label>
                  <label className="grid gap-1 text-sm font-semibold text-[color:var(--px-text)]">
                    Outcome
                    <select
                      className="rounded-[var(--px-radius-sm)] border border-[color:var(--px-border)] bg-[color:var(--px-surface)] px-3 py-2 text-sm text-[color:var(--px-text)] outline-none focus:ring-2 focus:ring-[color:var(--px-focus)]"
                      name="outcome"
                    >
                      <option value="metadata-reviewed">Metadata reviewed</option>
                      <option value="escalated">Escalated</option>
                      <option value="no-action">No action</option>
                    </select>
                  </label>
                  <Button type="submit" variant="secondary">Record review</Button>
                </form>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          body="No conversation metadata is available for review."
          title="No conversations"
        />
      )}
    </AdminSection>
  );
}
