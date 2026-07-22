import { AppSection } from "@/components/app-section";
import { Card } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { createSupportTicketAction } from "@/features/support/actions";

export default function NewSupportTicketPage() {
  return (
    <AppSection
      title="Create Support Ticket"
      description="Submit a new request for help with your account, deals, or other issues."
    >
      <Card className="max-w-2xl">
        <form action={createSupportTicketAction} className="grid gap-5">
          <Field label="Subject">
            <Input name="subject" placeholder="Briefly describe your issue" required />
          </Field>
          
          <Field label="Category">
            <select
              name="category"
              className="flex h-11 w-full rounded-[var(--px-radius-sm)] border border-[color:var(--px-border)] bg-[color:var(--px-surface)] px-3 py-2 text-sm text-[color:var(--px-text)] outline-none transition-colors hover:border-[color:var(--px-primary)] focus:border-[color:var(--px-primary)] focus:ring-1 focus:ring-[color:var(--px-primary)]"
              required
            >
              <option value="">Select a category</option>
              <option value="ACCOUNT">Account Access</option>
              <option value="DEAL">Deal & Escrow</option>
              <option value="TRUST">Trust & Moderation</option>
              <option value="TECHNICAL">Technical Issue</option>
              <option value="OTHER">Other</option>
            </select>
          </Field>

          <Field label="Message" hint="Provide as much detail as possible to help us resolve your issue quickly.">
            <Textarea name="message" placeholder="Describe your issue in detail..." required className="min-h-32" />
          </Field>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="submit">Submit Ticket</Button>
          </div>
        </form>
      </Card>
    </AppSection>
  );
}
