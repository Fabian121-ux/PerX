import { notFound } from "next/navigation";

import { AppSection } from "@/components/app-section";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { approveDeliveryAction, submitDeliveryAction } from "@/features/deals/actions";
import { getCurrentUser } from "@/lib/auth/session";
import { getDealForUser } from "@/lib/data/app";

export default async function DeliveriesPage({ params }: { params: Promise<{ dealId: string }> }) {
  const { dealId } = await params;
  const user = await getCurrentUser();
  const deal = await getDealForUser(dealId, user!.id);
  if (!deal) notFound();
  const participant = deal.participants.find(
    (entry: { userId: string }) => entry.userId === user!.id,
  );
  const participantRole = participant?.role.toLocaleLowerCase();
  const canSubmit = ["freelancer", "provider", "seller"].includes(
    participantRole ?? "",
  );
  const canApprove = ["client", "buyer"].includes(participantRole ?? "");
  const activeMilestones = deal.milestones.filter(
    (milestone: { status: string }) => milestone.status === "IN_PROGRESS",
  );
  const submittedMilestone = deal.milestones.find(
    (milestone: { status: string }) => milestone.status === "SUBMITTED",
  );

  return (
    <AppSection description="Authorized providers submit milestone work and clients record review decisions. Payment is not active for provider-disabled Deals." title="Deliveries">
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <h2 className="font-semibold text-slate-950">Submit delivery</h2>
          {canSubmit && deal.status === "IN_PROGRESS" && activeMilestones.length ? (
            <form action={submitDeliveryAction} className="mt-4 grid gap-4">
              <input name="dealId" type="hidden" value={deal.id} />
              <Field label="Milestone">
                <Select name="milestoneId" required>
                  {activeMilestones.map((milestone: { id: string; title: string }) => (
                    <option key={milestone.id} value={milestone.id}>
                      {milestone.title}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Title">
                <Input maxLength={140} name="title" required />
              </Field>
              <Field label="Notes">
                <Textarea maxLength={2000} name="notes" required />
              </Field>
              <Button type="submit">Submit delivery</Button>
            </form>
          ) : (
            <p className="mt-4 rounded-xl bg-[color:var(--px-muted)] p-3 text-sm leading-6 text-[color:var(--px-text-muted)]">
              {canSubmit
                ? "No milestone is currently open for delivery."
                : "Only the assigned provider can submit milestone work."}
            </p>
          )}
        </Card>
        <Card>
          <h2 className="font-semibold text-slate-950">Approval</h2>
          <p className="mt-2 text-sm leading-6 text-[color:var(--px-text-muted)]">Approval records a review decision against the submitted milestone. It does not claim that funds were collected, held, or released.</p>
          {canApprove && deal.status === "SUBMITTED" && submittedMilestone ? (
            <form action={approveDeliveryAction} className="mt-4">
              <input name="dealId" type="hidden" value={deal.id} />
              <input name="milestoneId" type="hidden" value={submittedMilestone.id} />
              <Button type="submit" variant="secondary">
                Approve submitted milestone
              </Button>
            </form>
          ) : (
            <p className="mt-4 rounded-xl bg-[color:var(--px-muted)] p-3 text-sm leading-6 text-[color:var(--px-text-muted)]">
              {canApprove
                ? "No submitted milestone is awaiting your review."
                : "Only the client or buyer can approve submitted work."}
            </p>
          )}
        </Card>
      </div>
    </AppSection>
  );
}
