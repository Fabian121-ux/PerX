import { notFound } from "next/navigation";

import { AppSection } from "@/components/app-section";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/form";
import { approveDeliveryAction, submitDeliveryAction } from "@/features/deals/actions";
import { getCurrentUser } from "@/lib/auth/session";
import { getDealForUser } from "@/lib/data/app";

export default async function DeliveriesPage({ params }: { params: Promise<{ dealId: string }> }) {
  const { dealId } = await params;
  const user = await getCurrentUser();
  const deal = await getDealForUser(dealId, user!.id);
  if (!deal) notFound();

  return (
    <AppSection description="Deliveries are separate from chat and can move the deal through escrow review and release states." title="Deliveries">
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <h2 className="font-semibold text-slate-950">Submit delivery</h2>
          <form action={submitDeliveryAction} className="mt-4 grid gap-4">
            <input name="dealId" type="hidden" value={deal.id} />
            <Field label="Title">
              <Input name="title" required />
            </Field>
            <Field label="Notes">
              <Textarea name="notes" required />
            </Field>
            <Button type="submit">Submit delivery</Button>
          </form>
        </Card>
        <Card>
          <h2 className="font-semibold text-slate-950">Approval</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">Approval validates the current state and records a simulated escrow release.</p>
          <form action={approveDeliveryAction} className="mt-4">
            <input name="dealId" type="hidden" value={deal.id} />
            <Button type="submit" variant="secondary">
              Approve and release
            </Button>
          </form>
        </Card>
      </div>
    </AppSection>
  );
}
